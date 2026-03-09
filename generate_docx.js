const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, HeadingLevel, BorderStyle, ImageRun,
    PageBreak, ShadingType, TableLayoutType, VerticalAlign,
    Header, Footer
} = require("docx");
const fs = require("fs");
const path = require("path");

const ACCENT = "0F7B6C";
const PRIMARY = "1A1A2E";
const TEXT_LIGHT = "6B6B80";
const ORANGE = "E8820C";
const WHITE = "FFFFFF";
const BG_SECTION = "F8F9FB";
const BORDER_COLOR = "E4E4EC";

async function generate() {
    // Load dashboard image
    const dashboardPath = path.join(__dirname, "..", "portfolio", "ilmavent", "dashboard.png");
    const dashboardBuf = fs.readFileSync(dashboardPath);

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: "Calibri", size: 22, color: "2D2D3A" }
                }
            }
        },
        sections: [
            // ===== PAGE 1: Header + Client + Problem =====
            {
                properties: {
                    page: {
                        margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 }
                    }
                },
                children: [
                    // === HEADER BLOCK ===
                    new Paragraph({
                        shading: { type: ShadingType.SOLID, color: PRIMARY, fill: PRIMARY },
                        spacing: { before: 0, after: 0 },
                        children: [new TextRun({ text: " ", size: 16, color: PRIMARY })]
                    }),
                    new Paragraph({
                        shading: { type: ShadingType.SOLID, color: PRIMARY, fill: PRIMARY },
                        spacing: { before: 200, after: 0 },
                        children: [
                            new TextRun({
                                text: "  КЕЙС",
                                size: 18,
                                color: "5CE0C8",
                                bold: true,
                                font: "Calibri"
                            })
                        ]
                    }),
                    new Paragraph({
                        shading: { type: ShadingType.SOLID, color: PRIMARY, fill: PRIMARY },
                        spacing: { before: 200, after: 0 },
                        children: [
                            new TextRun({
                                text: "  Автоматизация отдела продаж",
                                size: 52,
                                bold: true,
                                color: WHITE,
                                font: "Calibri"
                            })
                        ]
                    }),
                    new Paragraph({
                        shading: { type: ShadingType.SOLID, color: PRIMARY, fill: PRIMARY },
                        spacing: { before: 100, after: 400 },
                        children: [
                            new TextRun({
                                text: "  Ilmavent — проектирование и монтаж систем вентиляции, кондиционирования и увлажнения. Москва.",
                                size: 24,
                                color: "B0B0C0",
                                font: "Calibri"
                            })
                        ]
                    }),

                    // === CLIENT ===
                    new Paragraph({ spacing: { before: 400, after: 100 }, children: [] }),
                    new Paragraph({
                        spacing: { before: 0, after: 0 },
                        children: [
                            new TextRun({ text: "Ilmavent", size: 32, bold: true, color: PRIMARY, font: "Calibri" })
                        ]
                    }),
                    new Paragraph({
                        spacing: { before: 50, after: 300 },
                        children: [
                            new TextRun({
                                text: "Проектирование и монтаж вентиляции, кондиционирования, увлажнения. Четыре менеджера в отделе продаж.",
                                size: 22, color: TEXT_LIGHT, font: "Calibri"
                            })
                        ]
                    }),

                    // Divider
                    new Paragraph({
                        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR } },
                        spacing: { before: 0, after: 200 },
                        children: []
                    }),

                    // === ПРОБЛЕМА ===
                    new Paragraph({
                        spacing: { before: 200, after: 100 },
                        children: [
                            new TextRun({ text: "ПРОБЛЕМА", size: 16, bold: true, color: ACCENT, font: "Calibri", characterSpacing: 100 })
                        ]
                    }),
                    new Paragraph({
                        spacing: { before: 0, after: 200 },
                        children: [
                            new TextRun({
                                text: "Ручное распределение заявок и отсутствие контроля",
                                size: 36, bold: true, color: PRIMARY, font: "Calibri"
                            })
                        ]
                    }),
                    new Paragraph({
                        spacing: { before: 0, after: 200 },
                        children: [
                            new TextRun({
                                text: "Входящие заявки из шести источников (сайт, два рекламных квиза, WhatsApp, почта, Telegram) распределялись вручную. На эту задачу был выделен отдельный сотрудник — старший менеджер, который ежедневно обрабатывал поток через почту.",
                                size: 22, font: "Calibri"
                            })
                        ]
                    }),

                    // Problem highlight
                    new Paragraph({
                        shading: { type: ShadingType.SOLID, color: "FEF7F0", fill: "FEF7F0" },
                        border: { left: { style: BorderStyle.SINGLE, size: 6, color: ORANGE } },
                        spacing: { before: 100, after: 100 },
                        children: [
                            new TextRun({
                                text: "Процесс сопровождался системными рисками: задержки в распределении, отсутствие единого учёта обращений, невозможность отследить скорость и факт обработки каждой заявки. Руководитель отдела не располагал инструментами для оценки эффективности работы менеджеров в реальном времени.",
                                size: 21, color: "6B4D1F", font: "Calibri"
                            })
                        ]
                    }),
                ]
            },

            // ===== PAGE 2: Solution + Dashboard =====
            {
                properties: {
                    page: {
                        margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 }
                    }
                },
                children: [
                    new Paragraph({
                        spacing: { before: 0, after: 100 },
                        children: [
                            new TextRun({ text: "РЕШЕНИЕ", size: 16, bold: true, color: ACCENT, font: "Calibri", characterSpacing: 100 })
                        ]
                    }),
                    new Paragraph({
                        spacing: { before: 0, after: 200 },
                        children: [
                            new TextRun({
                                text: "Комплексная система автоматизации за 5 дней",
                                size: 36, bold: true, color: PRIMARY, font: "Calibri"
                            })
                        ]
                    }),

                    // Solution cards as styled paragraphs
                    ...createSolutionCard("🤖", "Единый канал приёма заявок",
                        "Telegram-бот объединил все шесть источников в один поток. Менеджер принимает заявку одним нажатием — в CRM автоматически создаются контакт, сделка и задача с дедлайном два часа. Встроена проверка на дубликаты. В ночное время заявки накапливаются и становятся доступны утром."),

                    ...createSolutionCard("📺", "Визуальный контроль",
                        "Веб-дашборд на экране в офисе отображает все активные заявки с цветовой индикацией: зелёный — в работе (до 2 часов), жёлтый — требует внимания (2–6 часов), красный — просрочено (более 6 часов). Автообновление каждые 30 секунд."),

                    ...createSolutionCard("⚙️", "Система ограничений",
                        "Автоматическая блокировка приёма новых заявок при накоплении более семи просроченных. Повторные нарушения — временное отстранение. Персональные уведомления менеджеру при каждой смене статуса заявки."),

                    ...createSolutionCard("📊", "Автоматическая отчётность",
                        "Еженедельные и ежемесячные отчёты формируются и отправляются в Telegram без участия человека: распределение заявок по менеджерам, просрочки, движение по воронке продаж."),

                    ...createSolutionCard("🔑", "Управление без технических навыков",
                        "Админ-панель реализована в Telegram — руководитель может добавить или заблокировать менеджера, запросить статистику. Для передачи проекта подготовлен паспорт с пошаговыми инструкциями."),

                    // Dashboard
                    new Paragraph({
                        spacing: { before: 200, after: 50 },
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: "Дашборд в офисе", size: 24, bold: true, color: PRIMARY, font: "Calibri" })
                        ]
                    }),
                    new Paragraph({
                        spacing: { before: 0, after: 50 },
                        alignment: AlignmentType.CENTER,
                        children: [
                            new ImageRun({
                                data: dashboardBuf,
                                transformation: { width: 520, height: 208 },
                                type: "png"
                            })
                        ]
                    }),
                    new Paragraph({
                        spacing: { before: 0, after: 0 },
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: "Данные на скриншоте демонстрационные", size: 16, italics: true, color: TEXT_LIGHT, font: "Calibri" })
                        ]
                    }),
                ]
            },

            // ===== PAGE 3: Results + Parameters + Footer =====
            {
                properties: {
                    page: {
                        margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 }
                    }
                },
                children: [
                    new Paragraph({
                        spacing: { before: 0, after: 100 },
                        children: [
                            new TextRun({ text: "РЕЗУЛЬТАТ", size: 16, bold: true, color: ACCENT, font: "Calibri", characterSpacing: 100 })
                        ]
                    }),
                    new Paragraph({
                        spacing: { before: 0, after: 200 },
                        children: [
                            new TextRun({
                                text: "Измеримые улучшения",
                                size: 36, bold: true, color: PRIMARY, font: "Calibri"
                            })
                        ]
                    }),

                    // Results table
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        layout: TableLayoutType.FIXED,
                        rows: [
                            createTableHeader("До внедрения", "После внедрения"),
                            createTableRow("Распределение заявок вручную — от 30 минут", "Автоматически — менее 5 секунд", false),
                            createTableRow("Требовался отдельный сотрудник на распределение", "Позиция не требуется — экономия на ставке", true),
                            createTableRow("Отсутствие контроля скорости обработки", "Полная прозрачность в реальном времени", false),
                            createTableRow("Ручное создание карточек в CRM", "Автоматическое создание при взятии заявки", true),
                            createTableRow("Отчётность по запросу", "Автоматические отчёты каждую неделю и месяц", false),
                        ]
                    }),

                    // Parameters
                    new Paragraph({
                        spacing: { before: 400, after: 200 },
                        children: [
                            new TextRun({ text: "ПАРАМЕТРЫ ПРОЕКТА", size: 16, bold: true, color: ACCENT, font: "Calibri", characterSpacing: 100 })
                        ]
                    }),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        layout: TableLayoutType.FIXED,
                        rows: [
                            new TableRow({
                                children: [
                                    createParamCell("Срок реализации", "5 дней"),
                                    createParamCell("Стоимость содержания", "770 ₽/мес"),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    createParamCell("Стек технологий", "Node.js · Telegram Bot API · Bitrix24 REST API · SQLite"),
                                    createParamCell("Гарантия", "3 месяца"),
                                ]
                            })
                        ]
                    }),

                    // Footer
                    new Paragraph({ spacing: { before: 600, after: 0 }, children: [] }),
                    new Paragraph({
                        border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR } },
                        spacing: { before: 200, after: 0 },
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: "Лариса Степаненкова", size: 24, bold: true, color: PRIMARY, font: "Calibri" })
                        ]
                    }),
                    new Paragraph({
                        spacing: { before: 50, after: 0 },
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: "март, 2026", size: 20, color: TEXT_LIGHT, font: "Calibri" })
                        ]
                    }),
                ]
            }
        ]
    });

    const outPath = path.join(__dirname, "..", "portfolio", "ilmavent", "case_study.docx");
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outPath, buffer);
    console.log("Done! Saved to:", outPath);
}

function createSolutionCard(emoji, title, text) {
    return [
        new Paragraph({
            shading: { type: ShadingType.SOLID, color: BG_SECTION, fill: BG_SECTION },
            border: {
                top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
                left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
                right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }
            },
            spacing: { before: 100, after: 0 },
            children: [
                new TextRun({ text: emoji + "  ", size: 22, font: "Calibri" }),
                new TextRun({ text: title, size: 24, bold: true, color: PRIMARY, font: "Calibri" })
            ]
        }),
        new Paragraph({
            shading: { type: ShadingType.SOLID, color: BG_SECTION, fill: BG_SECTION },
            border: {
                bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
                left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
                right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }
            },
            spacing: { before: 0, after: 100 },
            children: [
                new TextRun({ text: text, size: 20, color: TEXT_LIGHT, font: "Calibri" })
            ]
        })
    ];
}

function createTableHeader(col1, col2) {
    return new TableRow({
        children: [
            new TableCell({
                shading: { type: ShadingType.SOLID, color: PRIMARY, fill: PRIMARY },
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [new Paragraph({
                    children: [new TextRun({ text: col1, size: 18, bold: true, color: WHITE, font: "Calibri" })]
                })]
            }),
            new TableCell({
                shading: { type: ShadingType.SOLID, color: PRIMARY, fill: PRIMARY },
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [new Paragraph({
                    children: [new TextRun({ text: col2, size: 18, bold: true, color: WHITE, font: "Calibri" })]
                })]
            })
        ]
    });
}

function createTableRow(before, after, shaded) {
    const bg = shaded ? BG_SECTION : WHITE;
    return new TableRow({
        children: [
            new TableCell({
                shading: { type: ShadingType.SOLID, color: bg, fill: bg },
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [new Paragraph({
                    children: [new TextRun({ text: before, size: 20, color: TEXT_LIGHT, font: "Calibri" })]
                })]
            }),
            new TableCell({
                shading: { type: ShadingType.SOLID, color: bg, fill: bg },
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [new Paragraph({
                    children: [new TextRun({ text: after, size: 20, bold: true, color: ACCENT, font: "Calibri" })]
                })]
            })
        ]
    });
}

function createParamCell(label, value) {
    return new TableCell({
        shading: { type: ShadingType.SOLID, color: BG_SECTION, fill: BG_SECTION },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
            left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
            right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }
        },
        width: { size: 50, type: WidthType.PERCENTAGE },
        children: [
            new Paragraph({
                spacing: { before: 50, after: 0 },
                children: [new TextRun({ text: label, size: 16, bold: true, color: TEXT_LIGHT, font: "Calibri" })]
            }),
            new Paragraph({
                spacing: { before: 50, after: 50 },
                children: [new TextRun({ text: value, size: 28, bold: true, color: PRIMARY, font: "Calibri" })]
            })
        ]
    });
}

generate().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
