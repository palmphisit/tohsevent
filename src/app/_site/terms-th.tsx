import Link from "next/link";
import { LEGAL } from "@/lib/legal";

// Draft terms of service. Must be reviewed by a lawyer before launch.
export function TermsTh() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/th" className="text-sm text-slate-500 hover:text-slate-900">
        ← {LEGAL.serviceName}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">ข้อกำหนดการใช้งาน</h1>
      <p className="mt-1 text-sm text-slate-500">มีผลตั้งแต่ {LEGAL.effectiveDateTh}</p>

      <div className="mt-8 space-y-6 leading-7 text-slate-700 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc">
        <section>
          <h2>1. การใช้บริการ</h2>
          <p>
            {LEGAL.serviceName} ให้เจ้าภาพสร้างหน้างานเพื่อให้แขกแชร์และบันทึกรูปภาพ การใช้บริการถือว่าคุณยอมรับข้อกำหนดนี้และ{" "}
            <Link href="/th/privacy" className="underline">
              นโยบายความเป็นส่วนตัว
            </Link>
          </p>
        </section>
        <section>
          <h2>2. เนื้อหาที่อัปโหลด</h2>
          <ul>
            <li>คุณต้องมีสิทธิในรูปที่อัปโหลด และได้รับอนุญาตจากบุคคลในรูปตามสมควร</li>
            <li>ห้ามอัปโหลดเนื้อหาที่ผิดกฎหมาย ลามกอนาจาร รุนแรง หรือละเมิดสิทธิผู้อื่น เราและเจ้าภาพอาจซ่อนหรือลบรูปได้โดยไม่ต้องแจ้งล่วงหน้า</li>
            <li>คุณยังคงเป็นเจ้าของรูป และอนุญาตให้เราจัดเก็บ ย่อขนาด และแสดงรูปแก่ผู้ร่วมงานเพื่อให้บริการเท่านั้น</li>
          </ul>
        </section>
        <section>
          <h2>3. เจ้าภาพและการชำระเงิน</h2>
          <ul>
            <li>เจ้าภาพรับผิดชอบการตั้งค่าการเข้าถึงงานและการดูแลรูปในงานของตน</li>
            <li>แพ็กเกจเป็นการชำระครั้งเดียวต่องาน ราคาและสิทธิ์ตามที่แสดงในหน้าแพ็กเกจขณะชำระเงิน</li>
            <li>อัลบั้มจะปิดและลบตามระยะเวลาของแพ็กเกจ เจ้าภาพควรดาวน์โหลดรูปไว้ก่อนหมดอายุ</li>
          </ul>
        </section>
        <section>
          <h2>4. ข้อจำกัดความรับผิด</h2>
          <p>
            เราให้บริการตามสภาพที่เป็นอยู่ และจะพยายามอย่างดีที่สุดเพื่อให้บริการต่อเนื่องและปลอดภัย
            แต่ไม่รับประกันว่าบริการจะไม่ขัดข้องเลย
          </p>
        </section>
        <section>
          <h2>5. ติดต่อ</h2>
          <p>
            <a className="underline" href={`mailto:${LEGAL.contactEmail}`}>
              {LEGAL.contactEmail}
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
