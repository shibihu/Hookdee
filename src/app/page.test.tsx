import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("@/components/landing/site-header", () => ({ SiteHeader: () => null }));

it("renders the Thai landing headline, required pricing, comparison, and FAQ", () => {
  const html = renderToStaticMarkup(createElement(Home));

  expect(html).toContain("สคริปต์ AI ที่ฟังดูไม่เหมือนคุณ? พอได้แล้ว");
  expect(html).toContain("ตัวอย่างการปรับสคริปต์");
  expect(html).toContain("฿199");
  expect(html).toContain("฿1,990");
  expect(html).toContain("ทีม");
  expect(html).toContain("คำถามที่พบบ่อย");
});
