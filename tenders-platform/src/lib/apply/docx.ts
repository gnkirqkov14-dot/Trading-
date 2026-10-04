import { Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import type { GuideBlock } from "./types";

/**
 * Ръководството като Word файл. Заглавията са истински стилове „Heading“,
 * за да се прескача по тях с екранен четец (VoiceOver: ротор „Заглавия“),
 * а списъците — истински номерирани и с точки.
 */
export async function guideToDocx(title: string, subtitle: string, blocks: GuideBlock[]): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }),
    new Paragraph({ children: [new TextRun({ text: subtitle, italics: true })] }),
  ];
  let stepsList = 0;
  for (const block of blocks) {
    switch (block.kind) {
      case "h2":
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(block.text)] }));
        break;
      case "h3":
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(block.text)] }));
        break;
      case "h4":
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(block.text)] }));
        break;
      case "p":
        children.push(new Paragraph({ children: [new TextRun(block.text)] }));
        break;
      case "field":
        children.push(
          new Paragraph({ children: [new TextRun({ text: `${block.label}: `, bold: true }), new TextRun(block.value)] }),
        );
        break;
      case "warn":
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Внимание: ", bold: true }), new TextRun(block.text)] }),
        );
        break;
      case "quote":
        children.push(
          new Paragraph({
            indent: { left: 567 },
            children: [
              new TextRun({
                text: block.quote.verified
                  ? `Точният текст от ${block.source ? block.source.replace(/^У/, "у").replace(/^К/, "к") : "обявлението"}: `
                  : `Внимание, този откъс не беше намерен дословно в ${block.source ? "документите" : "обявлението"} — проверете го: `,
                bold: true,
              }),
              new TextRun({ text: `„${block.quote.text}“`, italics: true }),
            ],
          }),
        );
        break;
      case "list":
        for (const item of block.items) {
          children.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun(item)] }));
        }
        break;
      case "steps":
        stepsList += 1;
        for (const item of block.items) {
          children.push(
            new Paragraph({
              numbering: { reference: "steps", level: 0, instance: stepsList },
              children: [new TextRun(item)],
            }),
          );
        }
        break;
    }
  }

  const doc = new Document({
    title,
    creator: "porachkite.com",
    description: subtitle,
    styles: { default: { document: { run: { font: "Calibri", size: 24, language: { value: "bg-BG" } } } } },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT }],
        },
        {
          reference: "steps",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT }],
        },
      ],
    },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
