// k6 load test: many guests joining an event and uploading at the same time.
// Each iteration is one guest: join, upload PHOTOS_PER_GUEST photos (presign -> PUT to storage
// -> complete), then load the gallery like the guest page does.
//
// Run against a deployed environment (no local k6 needed):
//   docker run --rm -i -e BASE_URL=https://staging.example.com -e SLUG=demo \
//     grafana/k6:1.3.0 run - < scripts/load/guest-upload.js
//
// Against the local stack from Docker Desktop, reach the host via host.docker.internal and
// rewrite presigned storage URLs (the original Host header is kept so signatures stay valid):
//   docker run --rm -i -e BASE_URL=http://host.docker.internal:3002 -e SLUG=demo \
//     -e STORAGE_REWRITE=localhost:9000=host.docker.internal:9000 \
//     grafana/k6:1.3.0 run - < scripts/load/guest-upload.js
//
// Point BASE_URL only at environments you own; every upload creates real photos and files.
import http from "k6/http";
import { check, sleep } from "k6";
import { randomBytes } from "k6/crypto";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SLUG = __ENV.SLUG || "demo";
const PHOTOS_PER_GUEST = Number(__ENV.PHOTOS_PER_GUEST || 3);
const DISPLAY_BYTES = 300_000; // ~ a 2560px phone photo after client-side resize
const THUMB_BYTES = 30_000;

export const options = {
  scenarios: {
    guests: {
      executor: "ramping-vus",
      stages: [
        { duration: "20s", target: Number(__ENV.PEAK_VUS || 200) },
        { duration: "40s", target: Number(__ENV.PEAK_VUS || 200) },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:api}": ["p(95)<1500"],
    checks: ["rate>0.99"],
  },
};

const display = randomBytes(DISPLAY_BYTES);
const thumb = randomBytes(THUMB_BYTES);
const json = { headers: { "Content-Type": "application/json" }, tags: { kind: "api" } };
const [REWRITE_FROM, REWRITE_TO] = (__ENV.STORAGE_REWRITE || "").split("=");

function storagePut(target, payload) {
  const headers = { ...target.headers };
  let url = target.url;
  if (REWRITE_FROM && url.includes(`//${REWRITE_FROM}/`)) {
    url = url.replace(`//${REWRITE_FROM}/`, `//${REWRITE_TO}/`);
    headers.Host = REWRITE_FROM;
  }
  return ["PUT", url, payload, { headers, tags: { kind: "storage", name: "storage PUT" } }];
}

export default function guest() {
  const api = `${BASE_URL}/api/v1/events/${SLUG}`;
  const jar = http.cookieJar();

  const join = http.post(`${api}/session`, JSON.stringify({ displayName: `load-${__VU}-${__ITER}` }), json);
  check(join, { joined: (r) => r.status === 201 || r.status === 200 });

  for (let i = 0; i < PHOTOS_PER_GUEST; i++) {
    const body = JSON.stringify({
      files: [{ contentType: "image/jpeg", bytes: { display: DISPLAY_BYTES, thumb: THUMB_BYTES }, width: 2560, height: 1920 }],
    });
    const reserve = http.post(`${api}/uploads`, body, json);
    if (!check(reserve, { reserved: (r) => r.status === 201 })) continue;
    const { photoId, uploads } = reserve.json().uploads[0];

    const puts = http.batch([storagePut(uploads.display, display), storagePut(uploads.thumb, thumb)]);
    check(puts, { stored: (rs) => rs.every((r) => r.status === 200) });

    const complete = http.post(`${api}/photos/${photoId}/complete`, null, {
      ...json,
      tags: { kind: "api", name: `${api}/photos/:id/complete` },
    });
    check(complete, { completed: (r) => r.status === 200 });
  }

  const gallery = http.get(`${api}/photos?source=guest&limit=30`, { tags: { kind: "api" } });
  check(gallery, { gallery: (r) => r.status === 200 });
  jar.clear(BASE_URL);
  sleep(1);
}
