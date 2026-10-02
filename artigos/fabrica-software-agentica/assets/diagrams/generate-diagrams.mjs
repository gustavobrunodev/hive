import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const UPDATED = 1790208000000;

const C = {
  ink: "#1e293b",
  muted: "#64748b",
  paper: "#fffdf8",
  white: "#ffffff",
  purple: "#7c3aed",
  purpleFill: "#ede9fe",
  blue: "#2563eb",
  blueFill: "#dbeafe",
  green: "#15803d",
  greenFill: "#dcfce7",
  orange: "#c2410c",
  orangeFill: "#ffedd5",
  teal: "#0f766e",
  tealFill: "#ccfbf1",
  grayFill: "#f1f5f9",
  red: "#b91c1c",
  redFill: "#fee2e2",
};

let serial = 0;

function hash(value) {
  let h = 2166136261;
  for (const char of value) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function common(id, type, x, y, width, height, options = {}) {
  serial += 1;
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: options.strokeColor ?? C.ink,
    backgroundColor: options.backgroundColor ?? "transparent",
    fillStyle: "solid",
    strokeWidth: options.strokeWidth ?? 2,
    strokeStyle: options.strokeStyle ?? "solid",
    roughness: options.roughness ?? 1,
    opacity: options.opacity ?? 100,
    groupIds: options.groupIds ?? [],
    frameId: null,
    index: `a${serial.toString(36).padStart(3, "0")}`,
    roundness: options.roundness === false ? null : { type: 3 },
    seed: hash(`${id}:seed`),
    version: 1,
    versionNonce: hash(`${id}:nonce`),
    isDeleted: false,
    boundElements: [],
    updated: UPDATED,
    link: options.link ?? null,
    locked: false,
  };
}

function rect(id, x, y, width, height, options = {}) {
  return common(id, "rectangle", x, y, width, height, options);
}

function ellipse(id, x, y, width, height, options = {}) {
  return { ...common(id, "ellipse", x, y, width, height, { ...options, roundness: false }) };
}

function diamond(id, x, y, width, height, options = {}) {
  return { ...common(id, "diamond", x, y, width, height, { ...options, roundness: false }) };
}

function measureText(value, fontSize) {
  const lines = value.split("\n");
  const longest = Math.max(...lines.map((line) => [...line].length));
  return {
    width: Math.max(10, longest * fontSize * 0.56),
    height: lines.length * fontSize * 1.25,
  };
}

function text(id, x, y, value, options = {}) {
  const fontSize = options.fontSize ?? 24;
  const measured = measureText(value, fontSize);
  return {
    ...common(id, "text", x, y, options.width ?? measured.width, options.height ?? measured.height, {
      strokeColor: options.color ?? C.ink,
      strokeWidth: 1,
      roughness: 0,
      roundness: false,
    }),
    text: value,
    fontSize,
    fontFamily: 5,
    textAlign: options.textAlign ?? "left",
    verticalAlign: "top",
    containerId: null,
    originalText: value,
    autoResize: true,
    lineHeight: 1.25,
  };
}

function centeredText(id, x, y, width, value, options = {}) {
  const fontSize = options.fontSize ?? 24;
  const measured = measureText(value, fontSize);
  return text(id, x + (width - measured.width) / 2, y, value, {
    ...options,
    fontSize,
    textAlign: "center",
  });
}

function arrow(id, x1, y1, x2, y2, options = {}) {
  const width = x2 - x1;
  const height = y2 - y1;
  return {
    ...common(id, "arrow", x1, y1, Math.abs(width), Math.abs(height), {
      strokeColor: options.strokeColor ?? C.ink,
      strokeWidth: options.strokeWidth ?? 3,
      strokeStyle: options.strokeStyle ?? "solid",
      roughness: options.roughness ?? 1,
      roundness: false,
    }),
    width,
    height,
    points: [[0, 0], [width, height]],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: options.startArrowhead ?? null,
    endArrowhead: options.endArrowhead === undefined ? "arrow" : options.endArrowhead,
    elbowed: false,
  };
}

function line(id, x1, y1, x2, y2, options = {}) {
  return {
    ...arrow(id, x1, y1, x2, y2, { ...options, endArrowhead: null }),
    type: "line",
  };
}

function box(elements, id, x, y, width, height, title, subtitle, color, fill, options = {}) {
  elements.push(rect(id, x, y, width, height, {
    strokeColor: color,
    backgroundColor: fill,
    strokeWidth: options.strokeWidth ?? 2,
    roughness: options.roughness ?? 1,
  }));
  elements.push(centeredText(`${id}-title`, x, y + (options.titleY ?? 20), width, title, {
    fontSize: options.titleSize ?? 26,
    color,
  }));
  if (subtitle) {
    elements.push(centeredText(`${id}-subtitle`, x, y + (options.subtitleY ?? 66), width, subtitle, {
      fontSize: options.subtitleSize ?? 17,
      color: options.subtitleColor ?? C.ink,
    }));
  }
}

function iconBadge(elements, id, x, y, size, symbol, color, fill = C.white, options = {}) {
  elements.push(ellipse(id, x, y, size, size, {
    strokeColor: color,
    backgroundColor: fill,
    strokeWidth: options.strokeWidth ?? 2,
    roughness: options.roughness ?? 1,
  }));
  elements.push(centeredText(id + "-symbol", x, y + (options.symbolY ?? size * 0.22), size, symbol, {
    fontSize: options.fontSize ?? Math.round(size * 0.38),
    color,
  }));
}

function iconBox(elements, id, x, y, width, height, symbol, title, subtitle, color, fill, options = {}) {
  elements.push(rect(id, x, y, width, height, {
    strokeColor: color,
    backgroundColor: fill,
    strokeWidth: options.strokeWidth ?? 2,
    roughness: options.roughness ?? 1,
  }));
  const iconSize = options.iconSize ?? 56;
  const iconX = x + (options.iconX ?? 20);
  const iconY = y + (height - iconSize) / 2;
  iconBadge(elements, id + "-icon", iconX, iconY, iconSize, symbol, color, C.white, {
    fontSize: options.iconFontSize,
    symbolY: options.iconSymbolY,
  });
  const textX = x + (options.textX ?? 92);
  elements.push(text(id + "-title", textX, y + (options.titleY ?? 20), title, {
    fontSize: options.titleSize ?? 22,
    color,
  }));
  if (subtitle) {
    elements.push(text(id + "-subtitle", textX, y + (options.subtitleY ?? 58), subtitle, {
      fontSize: options.subtitleSize ?? 15,
      color: options.subtitleColor ?? C.ink,
    }));
  }
}

function pill(elements, id, x, y, width, label, color, fill, options = {}) {
  elements.push(rect(id, x, y, width, options.height ?? 48, {
    strokeColor: color,
    backgroundColor: fill,
    strokeWidth: options.strokeWidth ?? 2,
  }));
  elements.push(centeredText(id + "-text", x, y + (options.textY ?? 11), width, label, {
    fontSize: options.fontSize ?? 17,
    color,
  }));
}

function heading(elements, titleValue, subtitleValue, width) {
  elements.push(text("title", 70, 45, titleValue, { fontSize: 42, color: C.ink }));
  elements.push(text("subtitle", 72, 105, subtitleValue, { fontSize: 21, color: C.muted }));
  elements.push(line("title-line", 70, 145, width - 70, 145, { strokeColor: C.purple, strokeWidth: 3 }));
}

function scene(name, width, height, build) {
  serial = 0;
  const elements = [];
  build(elements, width, height);
  const payload = {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState: {
      gridSize: 20,
      gridStep: 5,
      gridModeEnabled: false,
      viewBackgroundColor: C.paper,
      exportBackground: true,
    },
    files: {},
  };
  writeFileSync(join(OUT, `${name}.excalidraw`), `${JSON.stringify(payload, null, 2)}\n`);
}

mkdirSync(OUT, { recursive: true });

scene("01-evolucao-fabrica-agentica", 1680, 720, (e, w) => {
  heading(e, "Da assistência à fábrica agêntica", "A evolução muda o gargalo: de gerar código para coordenar intenção e provar resultado", w);
  const stages = [
    ["1", "AUTOCOMPLETE", "Completar código\ne reduzir digitação", C.muted, C.grayFill],
    ["2", "CHAT EXECUTOR", "Ler, editar e\nexecutar comandos", C.blue, C.blueFill],
    ["3", "MÉTODO", "Skills, planos,\nTDD e debugging", C.purple, C.purpleFill],
    ["4", "ARTEFATOS", "Papéis, memória\ne handoffs", C.orange, C.orangeFill],
    ["5", "FÁBRICA", "Checks, verifier,\ne feedback", C.green, C.greenFill],
  ];
  const startX = 75;
  const y = 270;
  const bw = 270;
  const bh = 205;
  const gap = 55;
  stages.forEach(([n, titleValue, subtitleValue, color, fill], i) => {
    const x = startX + i * (bw + gap);
    if (i > 0) e.push(arrow(`stage-arrow-${i}`, x - gap + 10, y + 102, x - 12, y + 102, { strokeColor: C.muted }));
    const badgeX = x + (bw - 58) / 2;
    e.push(ellipse(`stage-number-${i}`, badgeX, y - 78, 58, 58, { strokeColor: color, backgroundColor: C.white, strokeWidth: 3 }));
    e.push(centeredText(`stage-number-text-${i}`, badgeX, y - 66, 58, n, { fontSize: 25, color }));
    box(e, `stage-${i}`, x, y, bw, bh, titleValue, subtitleValue, color, fill, { titleY: 50, subtitleY: 104 });
  });
  const firstCenter = startX + bw / 2;
  const lastX = startX + (stages.length - 1) * (bw + gap);
  const lastCenter = lastX + bw / 2;
  e.push(arrow("gargalo", firstCenter, 570, lastCenter, 570, { strokeColor: C.red, strokeWidth: 3 }));
  e.push(centeredText("gargalo-start", startX, 600, bw, "Gargalo: escrever", { fontSize: 19, color: C.muted }));
  e.push(centeredText("gargalo-end", lastX, 600, bw, "Gargalo: provar", { fontSize: 19, color: C.red }));
});

scene("02-fabrica-tobe", 1760, 1040, (e, w) => {
  heading(e, "Fábrica de software agêntica TO-BE", "Um sistema de produção orientado a eventos, com humanos nas decisões e evidência nos gates", w);

  e.push(rect("human-lane", 55, 190, 1650, 170, { strokeColor: C.orange, backgroundColor: C.orangeFill, opacity: 45, strokeStyle: "dashed" }));
  e.push(text("human-label", 300, 200, "DIREÇÃO HUMANA", { fontSize: 19, color: C.orange }));
  box(e, "event", 68, 235, 230, 90, "EVENTO", "oportunidade · incidente", C.orange, C.white, { titleY: 13, subtitleY: 51, titleSize: 23, subtitleSize: 15 });
  box(e, "decision", 708, 235, 330, 90, "DECISÃO DE DIREÇÃO", "outcome · risco · trade-offs", C.orange, C.white, { titleY: 13, subtitleY: 51, titleSize: 23, subtitleSize: 15 });
  box(e, "accept", 1438, 235, 250, 90, "ACEITAÇÃO", "merge · release · risco", C.orange, C.white, { titleY: 13, subtitleY: 51, titleSize: 23, subtitleSize: 15 });

  e.push(rect("agent-lane", 55, 410, 1650, 260, { strokeColor: C.blue, backgroundColor: C.blueFill, opacity: 35, strokeStyle: "dashed" }));
  e.push(text("agent-label", 300, 430, "EXECUÇÃO AGÊNTICA", { fontSize: 19, color: C.blue }));
  const steps = [
    ["intake", "INTAKE", "triagem", C.purple, C.purpleFill],
    ["discover", "DISCOVER", "problema", C.purple, C.purpleFill],
    ["shape", "SHAPE", "produto · UX · arquitetura", C.purple, C.purpleFill],
    ["plan", "PLAN", "fatias · checks", C.blue, C.white],
    ["implement", "IMPLEMENT", "código · testes", C.blue, C.white],
    ["verify", "VERIFY", "provas", C.green, C.greenFill],
    ["review", "REVIEW", "diff · PR", C.green, C.greenFill],
  ];
  const startX = 85;
  const y = 500;
  const bw = 195;
  const gap = 35;
  steps.forEach(([id, titleValue, subtitleValue, color, fill], i) => {
    const x = startX + i * (bw + gap);
    box(e, id, x, y, bw, 115, titleValue, subtitleValue, color, fill, { titleY: 19, subtitleY: 63, titleSize: 21, subtitleSize: 15 });
    if (i < steps.length - 1) e.push(arrow(`${id}-next`, x + bw + 6, y + 58, x + bw + gap - 8, y + 58, { strokeColor: C.ink, strokeWidth: 2 }));
  });

  e.push(rect("feedback-lane", 55, 725, 1650, 210, { strokeColor: C.green, backgroundColor: C.greenFill, opacity: 35, strokeStyle: "dashed" }));
  e.push(text("feedback-label", 300, 745, "OPERAÇÃO E FEEDBACK", { fontSize: 19, color: C.green }));
  box(e, "delivery", 1430, 805, 265, 90, "ENTREGA", "CI/CD · produção", C.green, C.white, { titleY: 13, subtitleY: 51, titleSize: 23, subtitleSize: 15 });
  box(e, "telemetry", 870, 805, 285, 90, "TELEMETRIA", "uso · qualidade · custo", C.green, C.white, { titleY: 13, subtitleY: 51, titleSize: 23, subtitleSize: 15 });
  box(e, "learning", 310, 805, 285, 90, "APRENDIZADO", "novo evento", C.green, C.white, { titleY: 13, subtitleY: 51, titleSize: 23, subtitleSize: 15 });
  e.push(arrow("event-intake", 185, 340, 183, 485, { strokeColor: C.orange, strokeStyle: "dashed" }));
  e.push(arrow("discover-decision", 410, 485, 790, 340, { strokeColor: C.orange, strokeStyle: "dashed" }));
  e.push(arrow("decision-plan", 873, 340, 873, 485, { strokeColor: C.orange, strokeStyle: "dashed" }));
  e.push(arrow("review-accept", 1563, 485, 1563, 340, { strokeColor: C.orange, strokeStyle: "dashed" }));
  e.push(arrow("review-delivery", 1563, 630, 1563, 790, { strokeColor: C.green }));
  e.push(text("after-acceptance", 1585, 690, "após aceite", { fontSize: 15, color: C.green }));
  e.push(arrow("delivery-telemetry", 1415, 850, 1170, 850, { strokeColor: C.green }));
  e.push(arrow("telemetry-learning", 855, 850, 610, 850, { strokeColor: C.green }));
  e.push(line("learning-loop-left", 310, 850, 45, 850, { strokeColor: C.purple, strokeStyle: "dashed" }));
  e.push(line("learning-loop-up", 45, 850, 45, 280, { strokeColor: C.purple, strokeStyle: "dashed" }));
  e.push(arrow("learning-loop-event", 45, 280, 70, 280, { strokeColor: C.purple, strokeStyle: "dashed" }));
  e.push(centeredText("external-note", 55, 965, 1650, "CI/CD, plataforma e observabilidade fecham o ciclo além do gate de PR", { fontSize: 18, color: C.muted }));
});

scene("03-posicionamento-frameworks", 1450, 980, (e, w) => {
  heading(e, "Quatro ferramentas, quatro posições", "O mapa descreve a ênfase principal — não um ranking de qualidade", w);
  const left = 220;
  const top = 245;
  const right = 1260;
  const bottom = 820;
  e.push(arrow("x-axis", left, bottom, right, bottom, { strokeColor: C.ink, strokeWidth: 3 }));
  e.push(arrow("y-axis", left, bottom, left, top, { strokeColor: C.ink, strokeWidth: 3 }));
  e.push(line("x-mid", 740, top, 740, bottom, { strokeColor: C.muted, strokeStyle: "dashed", strokeWidth: 2 }));
  e.push(line("y-mid", left, 530, right, 530, { strokeColor: C.muted, strokeStyle: "dashed", strokeWidth: 2 }));
  e.push(text("x-left", 205, 855, "CAPACIDADE PONTUAL", { fontSize: 17, color: C.muted }));
  e.push(text("x-right", 1045, 855, "SISTEMA MAIS AMPLO", { fontSize: 17, color: C.muted }));
  e.push(text("y-top", 62, 220, "GOVERNANÇA\nDE INTENÇÃO", { fontSize: 17, color: C.muted }));
  e.push(text("y-bottom", 62, 755, "GOVERNANÇA\nDE PROVA", { fontSize: 17, color: C.muted }));

  const quadrantLeftX = 320;
  const quadrantRightX = 840;
  const quadrantBoxWidth = 320;
  const quadrantBoxHeight = 145;
  box(e, "matt", quadrantLeftX, 315, quadrantBoxWidth, quadrantBoxHeight, "MATT POCOCK", "toolbox · elicitação\ndomínio · diagnóstico", C.orange, C.orangeFill, { titleY: 18, subtitleY: 66, titleSize: 24, subtitleSize: 16 });
  box(e, "bmad", quadrantRightX, 315, quadrantBoxWidth, quadrantBoxHeight, "BMAD", "produto → entrega\nartefatos · handoffs", C.purple, C.purpleFill, { titleY: 18, subtitleY: 66, titleSize: 27, subtitleSize: 17 });
  box(e, "superpowers", quadrantLeftX, 600, quadrantBoxWidth, quadrantBoxHeight, "SUPERPOWERS", "método de execução\nTDD · contexto · branch", C.blue, C.blueFill, { titleY: 18, subtitleY: 66, titleSize: 23, subtitleSize: 16 });
  box(e, "tlc", quadrantRightX, 600, quadrantBoxWidth, quadrantBoxHeight, "TLC", "delivery · checks\nverifier · review", C.green, C.greenFill, { titleY: 18, subtitleY: 66, titleSize: 27, subtitleSize: 17 });
  e.push(centeredText("rule", left, 905, right - left, "Escolha pela lacuna da sua fábrica, não pelo quadrante mais distante.", { fontSize: 20, color: C.ink }));
});

scene("04-composicoes-praticas", 1680, 1050, (e, w) => {
  heading(e, "Composição por fronteiras de artefato", "Uma fase tem um controlador; a próxima recebe um contrato, não todo o histórico da conversa", w);
  const columnX = [155, 635, 1115];
  const columnWidth = 405;
  e.push(centeredText("column-upstream", columnX[0], 177, columnWidth, "UPSTREAM", { fontSize: 17, color: C.muted }));
  e.push(centeredText("column-handoff", columnX[1], 177, columnWidth, "HANDOFF", { fontSize: 17, color: C.muted }));
  e.push(centeredText("column-delivery", columnX[2], 177, columnWidth, "DELIVERY / SAÍDA", { fontSize: 17, color: C.muted }));
  const rows = [
    {
      y: 230,
      n: "1",
      label: "Elicitação leve + delivery verificável",
      boxes: [
        ["GRILL-ME", "decisões", C.orange, C.orangeFill],
        ["ARTEFATO DURÁVEL", "brief · ADR · contexto", C.purple, C.purpleFill],
        ["TLC", "plan · implement · judge", C.green, C.greenFill],
      ],
    },
    {
      y: 480,
      n: "2",
      label: "Produto amplo + execução por provas",
      boxes: [
        ["BMAD", "brief · PRD · UX · arquitetura", C.purple, C.purpleFill],
        ["SPEC / SLICE", "intenção congelada", C.blue, C.blueFill],
        ["TLC", "build · verify · review", C.green, C.greenFill],
      ],
    },
    {
      y: 730,
      n: "3",
      label: "Coordenação externa + oficina disciplinada",
      boxes: [
        ["TRACKER / BMAD", "prioridade · status", C.purple, C.purpleFill],
        ["SUPERPOWERS", "plan · SDD/Native · TDD", C.blue, C.blueFill],
        ["PR + EVIDÊNCIA", "commit · testes · findings", C.green, C.greenFill],
      ],
    },
  ];
  rows.forEach((row) => {
    e.push(ellipse(`row-${row.n}`, 70, row.y + 87, 58, 58, { strokeColor: C.ink, backgroundColor: C.white, strokeWidth: 3 }));
    e.push(centeredText(`row-${row.n}-text`, 70, row.y + 99, 58, row.n, { fontSize: 25, color: C.ink }));
    e.push(text(`row-${row.n}-label`, 155, row.y, row.label, { fontSize: 21, color: C.ink }));
    const x0 = columnX[0];
    const bw = columnWidth;
    const gap = 75;
    row.boxes.forEach(([titleValue, subtitleValue, color, fill], i) => {
      const x = x0 + i * (bw + gap);
      box(e, `row-${row.n}-box-${i}`, x, row.y + 48, bw, 135, titleValue, subtitleValue, color, fill, { titleY: 20, subtitleY: 72, titleSize: 23, subtitleSize: 16 });
      if (i < 2) e.push(arrow(`row-${row.n}-arrow-${i}`, x + bw + 10, row.y + 116, x + bw + gap - 10, row.y + 116, { strokeColor: C.ink }));
    });
  });
  e.push(rect("anti-pattern", 250, 965, 1180, 58, { strokeColor: C.red, backgroundColor: C.redFill, strokeStyle: "dashed" }));
  e.push(centeredText("anti-pattern-text", 250, 980, 1180, "Evite dois discoveries, duas specs ou duas políticas de commit governando a mesma fase.", { fontSize: 19, color: C.red }));
});

scene("05-arvore-decisao", 1600, 1280, (e, w) => {
  heading(e, "Qual composição adotar?", "Comece pelo gargalo, depois ajuste o rigor à capacidade do implementador e ao risco", w);

  e.push(rect("q1", 620, 220, 360, 120, { strokeColor: C.purple, backgroundColor: C.purpleFill, strokeWidth: 3 }));
  e.push(centeredText("q1-text", 620, 247, 360, "1 · O problema ainda\né ambíguo?", { fontSize: 22, color: C.purple }));

  box(e, "discovery", 85, 455, 430, 135, "DISCOVERY PRIMEIRO", "Matt grill-me ou BMAD\nbrief / PRD", C.orange, C.orangeFill, { titleY: 18, subtitleY: 66, titleSize: 23, subtitleSize: 17 });
  e.push(rect("q2", 620, 440, 360, 130, { strokeColor: C.blue, backgroundColor: C.blueFill, strokeWidth: 3 }));
  e.push(centeredText("q2-text", 620, 475, 360, "2 · O implementador\né frontier?", { fontSize: 22, color: C.blue }));

  box(e, "lean", 1085, 455, 430, 135, "ROTA LEAN", "TLC spec-lean / implement\n+ checks fortes", C.blue, C.blueFill, { titleY: 18, subtitleY: 66, titleSize: 23, subtitleSize: 17 });
  box(e, "driven", 565, 720, 470, 135, "ROTA GRANULAR", "TLC spec-driven ou\nSuperpowers writing-plans", C.purple, C.purpleFill, { titleY: 18, subtitleY: 66, titleSize: 23, subtitleSize: 17 });

  e.push(rect("q3", 620, 935, 360, 130, { strokeColor: C.green, backgroundColor: C.greenFill, strokeWidth: 3 }));
  e.push(centeredText("q3-text", 620, 970, 360, "3 · O risco exige\ncontestação forte?", { fontSize: 22, color: C.green }));

  box(e, "standard", 95, 1110, 500, 120, "RISCO NORMAL", "gates do repo + review fresco", C.blue, C.white, { titleY: 16, subtitleY: 65, titleSize: 23, subtitleSize: 17 });
  box(e, "strict", 1005, 1110, 500, 120, "RISCO ALTO", "verifier independente + the-judge\n+ evidência retida", C.green, C.greenFill, { titleY: 16, subtitleY: 62, titleSize: 23, subtitleSize: 17 });

  e.push(arrow("q1-yes", 655, 352, 400, 443, { strokeColor: C.orange }));
  e.push(text("q1-yes-label", 505, 370, "SIM", { fontSize: 17, color: C.orange }));
  e.push(arrow("q1-no", 800, 352, 800, 428, { strokeColor: C.blue }));
  e.push(text("q1-no-label", 818, 382, "NÃO", { fontSize: 17, color: C.blue }));
  e.push(arrow("discovery-q2", 527, 522, 608, 522, { strokeColor: C.muted, strokeStyle: "dashed" }));
  e.push(arrow("q2-yes", 992, 522, 1073, 522, { strokeColor: C.blue }));
  e.push(text("q2-yes-label", 1008, 485, "SIM", { fontSize: 17, color: C.blue }));
  e.push(arrow("q2-no", 800, 582, 800, 708, { strokeColor: C.purple }));
  e.push(text("q2-no-label", 818, 640, "NÃO", { fontSize: 17, color: C.purple }));
  e.push(line("lean-q3-upper", 1300, 602, 1120, 680, { strokeColor: C.green, strokeStyle: "dashed" }));
  e.push(line("lean-q3-side", 1120, 680, 1120, 880, { strokeColor: C.green, strokeStyle: "dashed" }));
  e.push(arrow("lean-q3", 1120, 880, 945, 923, { strokeColor: C.green, strokeStyle: "dashed" }));
  e.push(arrow("driven-q3", 800, 867, 800, 923, { strokeColor: C.green, strokeStyle: "dashed" }));
  e.push(arrow("q3-no", 655, 1077, 520, 1098, { strokeColor: C.blue }));
  e.push(text("q3-no-label", 530, 1040, "NÃO", { fontSize: 17, color: C.blue }));
  e.push(arrow("q3-yes", 945, 1077, 1080, 1098, { strokeColor: C.green }));
  e.push(text("q3-yes-label", 1038, 1040, "SIM", { fontSize: 17, color: C.green }));
});

scene("06-evento-ao-feedback", 1760, 1120, (e, w) => {
  heading(e, "Do evento ao feedback", "Entradas diferentes atravessam a mesma linha e retornam como aprendizado", w);

  const inputs = [
    ["issue", "#", "ISSUE", "engenharia"],
    ["slack", "S", "SLACK", "produto · suporte"],
    ["alert", "!", "ALERTA", "observabilidade"],
    ["backlog", "≡", "BACKLOG", "prioridade"],
  ];
  const inputX = [120, 500, 880, 1260];
  inputs.forEach(([id, symbol, titleValue, subtitleValue], i) => {
    iconBox(e, id, inputX[i], 205, 300, 100, symbol, titleValue, subtitleValue, C.orange, C.orangeFill, {
      iconSize: 52,
      textX: 90,
      titleY: 18,
      subtitleY: 56,
      titleSize: 21,
      subtitleSize: 14,
    });
    e.push(line(id + "-collector", inputX[i] + 150, 315, inputX[i] + 150, 345, {
      strokeColor: C.orange,
      strokeStyle: "dashed",
      strokeWidth: 2,
    }));
  });
  e.push(line("input-collector", 270, 345, 1410, 345, { strokeColor: C.orange, strokeStyle: "dashed", strokeWidth: 2 }));
  e.push(arrow("collector-intake", 880, 345, 880, 385, { strokeColor: C.orange, strokeWidth: 3 }));

  iconBox(e, "intake-triage", 650, 400, 460, 110, "Y", "INTAKE + TRIAGEM", "normaliza · classifica · prioriza", C.purple, C.purpleFill, {
    iconSize: 60,
    textX: 105,
    titleY: 20,
    subtitleY: 62,
    titleSize: 24,
    subtitleSize: 16,
  });

  const stages = [
    ["discover", "?", "DISCOVER", "problema", C.purple, C.purpleFill],
    ["plan", "≡", "PLAN", "fatias · checks", C.blue, C.blueFill],
    ["implement", "</>", "IMPLEMENT", "código · testes", C.blue, C.white],
    ["verify", "✓", "VERIFY", "provas", C.green, C.greenFill],
    ["review", "◎", "REVIEW", "diff · risco", C.green, C.white],
  ];
  const stageX = [55, 380, 705, 1030, 1355];
  e.push(line("intake-to-flow-down", 880, 520, 880, 545, { strokeColor: C.purple, strokeWidth: 3 }));
  e.push(line("intake-to-flow-left", 880, 545, 190, 545, { strokeColor: C.purple, strokeWidth: 3 }));
  e.push(arrow("intake-to-discover", 190, 545, 190, 575, { strokeColor: C.purple, strokeWidth: 3 }));
  stages.forEach(([id, symbol, titleValue, subtitleValue, color, fill], i) => {
    iconBox(e, id, stageX[i], 590, 270, 120, symbol, titleValue, subtitleValue, color, fill, {
      iconSize: 50,
      iconFontSize: symbol === "</>" ? 16 : 20,
      textX: 82,
      titleY: 24,
      subtitleY: 68,
      titleSize: 20,
      subtitleSize: 15,
    });
    if (i < stages.length - 1) {
      e.push(arrow(id + "-next", stageX[i] + 282, 650, stageX[i + 1] - 12, 650, { strokeColor: C.ink, strokeWidth: 2 }));
    }
  });

  iconBox(e, "pull-request", 1355, 775, 270, 105, "PR", "PULL REQUEST", "diff + evidência", C.green, C.greenFill, {
    iconSize: 50,
    iconFontSize: 17,
    textX: 82,
    titleY: 20,
    subtitleY: 60,
    titleSize: 20,
    subtitleSize: 15,
  });
  e.push(arrow("review-pr", 1490, 720, 1490, 763, { strokeColor: C.green, strokeWidth: 3 }));

  iconBox(e, "production-feedback", 1245, 945, 490, 110, "↻", "PRODUÇÃO + FEEDBACK", "uso · qualidade · custo · incidentes", C.green, C.white, {
    iconSize: 60,
    textX: 105,
    titleY: 20,
    subtitleY: 62,
    titleSize: 23,
    subtitleSize: 15,
  });
  e.push(arrow("pr-production", 1490, 890, 1490, 933, { strokeColor: C.green, strokeWidth: 3 }));

  e.push(line("feedback-left", 1233, 1000, 35, 1000, { strokeColor: C.purple, strokeStyle: "dashed", strokeWidth: 3 }));
  e.push(line("feedback-up", 35, 1000, 35, 255, { strokeColor: C.purple, strokeStyle: "dashed", strokeWidth: 3 }));
  e.push(arrow("feedback-reentry", 35, 255, 108, 255, { strokeColor: C.purple, strokeStyle: "dashed", strokeWidth: 3 }));
  e.push(text("feedback-label", 58, 960, "novo evento", { fontSize: 16, color: C.purple }));
});

scene("07-fabrica-agentica-completa", 1900, 1320, (e, w) => {
  heading(e, "A fábrica agêntica completa", "Intenção humana, execução assistida, controles verificáveis e produção em ciclo fechado", w);

  e.push(rect("human-lane", 55, 185, 1790, 165, { strokeColor: C.orange, backgroundColor: C.orangeFill, opacity: 42, strokeStyle: "dashed" }));
  e.push(text("human-lane-label", 90, 202, "DIREÇÃO HUMANA", { fontSize: 18, color: C.orange }));
  iconBox(e, "human-event", 90, 235, 280, 90, "!", "EVENTO", "intenção · incidente", C.orange, C.white, {
    iconSize: 48,
    textX: 82,
    titleY: 14,
    subtitleY: 50,
    titleSize: 21,
    subtitleSize: 14,
  });
  iconBox(e, "human-direction", 755, 235, 390, 90, "↗", "DECISÃO DE DIREÇÃO", "outcome · risco · trade-offs", C.orange, C.white, {
    iconSize: 48,
    textX: 82,
    titleY: 14,
    subtitleY: 50,
    titleSize: 21,
    subtitleSize: 14,
  });
  iconBox(e, "human-accept", 1530, 235, 280, 90, "✓", "ACEITAÇÃO", "merge · release", C.orange, C.white, {
    iconSize: 48,
    textX: 82,
    titleY: 14,
    subtitleY: 50,
    titleSize: 21,
    subtitleSize: 14,
  });

  e.push(rect("agent-lane", 55, 400, 1790, 285, { strokeColor: C.blue, backgroundColor: C.blueFill, opacity: 32, strokeStyle: "dashed" }));
  e.push(text("agent-lane-label", 90, 420, "LINHA AGÊNTICA", { fontSize: 18, color: C.blue }));
  const agentStages = [
    ["entry", "#", "ENTRY", "item normalizado", C.purple, C.purpleFill],
    ["triage", "Y", "TRIAGE", "rota · estado", C.purple, C.white],
    ["discover-full", "?", "DISCOVER", "problema · outcome", C.purple, C.purpleFill],
    ["plan-full", "≡", "PLAN", "fatias · provas", C.blue, C.white],
    ["implement-full", "</>", "IMPLEMENT", "código · testes", C.blue, C.blueFill],
    ["gate-full", "✓", "GATE", "verify · review", C.green, C.greenFill],
    ["production-full", "▦", "PRODUCTION", "deploy · operação", C.green, C.white],
  ];
  const startX = 80;
  const cardWidth = 225;
  const gap = 28;
  agentStages.forEach(([id, symbol, titleValue, subtitleValue, color, fill], i) => {
    const x = startX + i * (cardWidth + gap);
    iconBox(e, id, x, 500, cardWidth, 125, symbol, titleValue, subtitleValue, color, fill, {
      iconSize: 48,
      iconFontSize: symbol === "</>" ? 15 : 19,
      textX: 76,
      titleY: 25,
      subtitleY: 69,
      titleSize: 18,
      subtitleSize: 13,
    });
    if (i < agentStages.length - 1) {
      e.push(arrow(id + "-next", x + cardWidth + 7, 563, x + cardWidth + gap - 8, 563, { strokeColor: C.ink, strokeWidth: 2 }));
    }
  });

  e.push(arrow("event-entry", 230, 338, 193, 488, { strokeColor: C.orange, strokeStyle: "dashed" }));
  e.push(arrow("discover-direction", 690, 488, 870, 338, { strokeColor: C.orange, strokeStyle: "dashed" }));
  e.push(arrow("direction-plan", 950, 338, 940, 488, { strokeColor: C.orange, strokeStyle: "dashed" }));
  e.push(arrow("gate-accept", 1458, 488, 1650, 338, { strokeColor: C.orange, strokeStyle: "dashed" }));

  e.push(rect("control-lane", 55, 740, 1790, 220, { strokeColor: C.purple, backgroundColor: C.purpleFill, opacity: 30, strokeStyle: "dashed" }));
  e.push(text("control-lane-label", 90, 760, "CONTRATOS, CONTEXTO E PROVA", { fontSize: 18, color: C.purple }));
  const controls = [
    ["artifacts", "D", "ARTEFATOS", "PRD · ADR · task", C.orange, C.orangeFill],
    ["context", "40", "CONTEXTO", "janela nova por fase", C.purple, C.white],
    ["harness", "H", "HARNESS", "guia · sensor · gate", C.blue, C.blueFill],
    ["proof", "≠", "PROVA", "autor ≠ verifier", C.green, C.greenFill],
  ];
  const controlX = [105, 535, 965, 1395];
  controls.forEach(([id, symbol, titleValue, subtitleValue, color, fill], i) => {
    iconBox(e, id, controlX[i], 815, 360, 110, symbol, titleValue, subtitleValue, color, fill, {
      iconSize: 56,
      iconFontSize: symbol === "40" ? 16 : 21,
      textX: 96,
      titleY: 20,
      subtitleY: 62,
      titleSize: 21,
      subtitleSize: 15,
    });
  });
  e.push(text("model-policy", 610, 975, "Capacidade do implementador decide: granular ↔ lean", { fontSize: 17, color: C.muted }));

  e.push(rect("operation-lane", 55, 1030, 1790, 205, { strokeColor: C.green, backgroundColor: C.greenFill, opacity: 32, strokeStyle: "dashed" }));
  e.push(text("operation-lane-label", 90, 1050, "OPERAÇÃO E APRENDIZADO", { fontSize: 18, color: C.green }));
  iconBox(e, "learning", 170, 1110, 330, 90, "↻", "APRENDIZADO", "novo evento", C.green, C.white, {
    iconSize: 48,
    textX: 82,
    titleY: 14,
    subtitleY: 50,
    titleSize: 21,
    subtitleSize: 14,
  });
  iconBox(e, "telemetry", 785, 1110, 330, 90, "∿", "TELEMETRIA", "uso · qualidade · custo", C.green, C.white, {
    iconSize: 48,
    textX: 82,
    titleY: 14,
    subtitleY: 50,
    titleSize: 21,
    subtitleSize: 14,
  });
  iconBox(e, "delivery", 1400, 1110, 330, 90, "CI", "ENTREGA", "CI/CD · produção", C.green, C.white, {
    iconSize: 48,
    iconFontSize: 15,
    textX: 82,
    titleY: 14,
    subtitleY: 50,
    titleSize: 21,
    subtitleSize: 14,
  });
  e.push(arrow("production-delivery", 1710, 638, 1570, 1098, { strokeColor: C.green, strokeWidth: 3 }));
  e.push(arrow("delivery-telemetry", 1388, 1155, 1127, 1155, { strokeColor: C.green, strokeWidth: 3 }));
  e.push(arrow("telemetry-learning", 773, 1155, 512, 1155, { strokeColor: C.green, strokeWidth: 3 }));
  e.push(line("learning-loop-left", 158, 1155, 35, 1155, { strokeColor: C.purple, strokeStyle: "dashed", strokeWidth: 3 }));
  e.push(line("learning-loop-up", 35, 1155, 35, 280, { strokeColor: C.purple, strokeStyle: "dashed", strokeWidth: 3 }));
  e.push(arrow("learning-loop-event", 35, 280, 78, 280, { strokeColor: C.purple, strokeStyle: "dashed", strokeWidth: 3 }));
  e.push(centeredText("factory-note", 55, 1260, 1790, "O humano governa intenção e irreversibilidade; a linha automatiza execução, evidência e feedback.", { fontSize: 18, color: C.muted }));
});

scene("08-contexto-por-fase", 1650, 930, (e, w) => {
  heading(e, "Contexto é orçamento", "Abra a janela para pesquisar; reduza e renove o contexto para construir e verificar", w);

  e.push(text("gauge-label", 95, 200, "OCUPAÇÃO DA JANELA", { fontSize: 18, color: C.ink }));
  e.push(rect("gauge-safe", 95, 245, 584, 78, { strokeColor: C.green, backgroundColor: C.greenFill, roughness: 0 }));
  e.push(rect("gauge-watch", 679, 245, 292, 78, { strokeColor: C.orange, backgroundColor: C.orangeFill, roughness: 0 }));
  e.push(rect("gauge-risk", 971, 245, 584, 78, { strokeColor: C.red, backgroundColor: C.redFill, roughness: 0 }));
  e.push(centeredText("gauge-safe-text", 95, 267, 584, "ATÉ ~40% · confortável", { fontSize: 19, color: C.green }));
  e.push(centeredText("gauge-watch-text", 679, 267, 292, "40–60% · atenção", { fontSize: 18, color: C.orange }));
  e.push(centeredText("gauge-risk-text", 971, 267, 584, "ACIMA DE 60% · risco crescente", { fontSize: 19, color: C.red }));
  e.push(text("heuristic-note", 95, 340, "Heurística operacional — a direção da degradação é medida; os limiares variam por tarefa e modelo.", { fontSize: 16, color: C.muted }));

  const phases = [
    ["research", "∞", "RESEARCH", "links · MCPs · métricas\ncontexto amplo", C.orange, C.orangeFill],
    ["plan-context", "D", "PLAN", "decisão + código\nrelevante", C.purple, C.purpleFill],
    ["implement-context", "N", "IMPLEMENT", "janela nova\nsó o contrato", C.blue, C.blueFill],
    ["verify-context", "≠", "VERIFY", "outro agente\nchecks + diff", C.green, C.greenFill],
    ["review-context", "◎", "REVIEW", "gates · riscos\nveredito", C.green, C.white],
  ];
  const phaseX = [55, 375, 695, 1015, 1335];
  phases.forEach(([id, symbol, titleValue, subtitleValue, color, fill], i) => {
    box(e, id, phaseX[i], 475, 260, 190, titleValue, subtitleValue, color, fill, {
      titleY: 48,
      subtitleY: 98,
      titleSize: 21,
      subtitleSize: 15,
    });
    iconBadge(e, id + "-badge", phaseX[i] + 101, 430, 58, symbol, color, C.white, {
      fontSize: symbol === "∞" ? 25 : 20,
    });
    if (i < phases.length - 1) {
      e.push(arrow(id + "-next", phaseX[i] + 272, 570, phaseX[i + 1] - 12, 570, { strokeColor: C.ink, strokeWidth: 2 }));
      e.push(text(id + "-handoff", phaseX[i] + 265, 610, "artefato", { fontSize: 13, color: C.muted }));
    }
  });

  e.push(rect("context-rule", 210, 745, 1230, 95, { strokeColor: C.purple, backgroundColor: C.white, strokeStyle: "dashed" }));
  e.push(centeredText("context-rule-title", 210, 765, 1230, "COMPACTAÇÃO DESCARTA; CONTRATO DURÁVEL PRESERVA", { fontSize: 21, color: C.purple }));
  e.push(centeredText("context-rule-subtitle", 210, 805, 1230, "A conversa pode acabar quando decisões, checks e handoffs vivem fora dela.", { fontSize: 16, color: C.ink }));
});

scene("09-cadeia-de-artefatos", 1760, 980, (e, w) => {
  heading(e, "A cadeia de artefatos", "Cada documento responde a uma pergunta e vive perto de quem o altera ou consome", w);

  const columns = [
    { id: "why", x: 70, color: C.orange, fill: C.orangeFill, title: "POR QUÊ?", subtitle: "intenção e direção" },
    { id: "what", x: 650, color: C.purple, fill: C.purpleFill, title: "O QUÊ?", subtitle: "decisão e unidade" },
    { id: "proof", x: 1230, color: C.green, fill: C.greenFill, title: "COMO PROVAR?", subtitle: "evidência e aceite" },
  ];
  columns.forEach((column) => {
    e.push(rect(column.id + "-lane", column.x, 215, 460, 610, {
      strokeColor: column.color,
      backgroundColor: column.fill,
      opacity: 35,
      strokeStyle: "dashed",
    }));
    e.push(centeredText(column.id + "-title", column.x, 245, 460, column.title, { fontSize: 27, color: column.color }));
    e.push(centeredText(column.id + "-subtitle", column.x, 288, 460, column.subtitle, { fontSize: 16, color: C.muted }));
  });
  e.push(arrow("why-what", 542, 515, 638, 515, { strokeColor: C.ink, strokeWidth: 3 }));
  e.push(arrow("what-proof", 1122, 515, 1218, 515, { strokeColor: C.ink, strokeWidth: 3 }));

  iconBox(e, "prd", 115, 365, 370, 120, "P", "PRD", "problema · público · resultado", C.orange, C.white, {
    iconSize: 52, textX: 90, titleY: 24, subtitleY: 68, titleSize: 22, subtitleSize: 14,
  });
  iconBox(e, "design", 115, 535, 370, 120, "D", "DESIGN DOC / RFC", "solução · alternativas · risco", C.orange, C.white, {
    iconSize: 52, textX: 90, titleY: 24, subtitleY: 68, titleSize: 21, subtitleSize: 14,
  });
  pill(e, "why-location", 145, 720, 310, "WORKSPACE COLABORATIVO", C.orange, C.white, { fontSize: 15 });

  iconBox(e, "adr", 695, 365, 370, 120, "A", "ADR", "decisão durável", C.purple, C.white, {
    iconSize: 52, textX: 90, titleY: 24, subtitleY: 68, titleSize: 22, subtitleSize: 14,
  });
  iconBox(e, "task", 695, 535, 370, 120, "T", "TASK", "fronteira · fatia · critérios", C.purple, C.white, {
    iconSize: 52, textX: 90, titleY: 24, subtitleY: 68, titleSize: 22, subtitleSize: 14,
  });
  pill(e, "what-location-repo", 685, 710, 180, "ADR · REPO", C.purple, C.white, { fontSize: 14 });
  pill(e, "what-location-tracker", 895, 710, 180, "TASK · TRACKER", C.purple, C.white, { fontSize: 14 });

  iconBox(e, "checklist", 1275, 365, 370, 120, "✓", "CHECKLIST", "afirmação + prova", C.green, C.white, {
    iconSize: 52, textX: 90, titleY: 24, subtitleY: 68, titleSize: 22, subtitleSize: 14,
  });
  iconBox(e, "pr-review", 1275, 535, 370, 120, "PR", "PR / REVIEW", "diff · evidência · riscos", C.green, C.white, {
    iconSize: 52, iconFontSize: 16, textX: 90, titleY: 24, subtitleY: 68, titleSize: 22, subtitleSize: 14,
  });
  pill(e, "proof-location", 1305, 720, 310, "GIT + RELATÓRIO DA EXECUÇÃO", C.green, C.white, { fontSize: 14 });

  e.push(rect("artifact-rule", 300, 870, 1160, 65, { strokeColor: C.ink, backgroundColor: C.white }));
  e.push(centeredText("artifact-rule-text", 300, 888, 1160, "Estado mutável no tracker · decisão durável perto do código · colaboração onde as pessoas trabalham", { fontSize: 17, color: C.ink }));
});

scene("10-harness-e-autonomia", 1760, 1080, (e, w) => {
  heading(e, "Harness: guiar, medir e impedir", "Autonomia nasce quando a proposta do modelo atravessa controles externos e observáveis", w);

  iconBox(e, "model", 95, 210, 285, 100, "AI", "MODELO PROPÕE", "ação ou conclusão", C.purple, C.purpleFill, {
    iconSize: 52, iconFontSize: 15, textX: 90, titleY: 20, subtitleY: 58, titleSize: 20, subtitleSize: 14,
  });
  iconBox(e, "hook", 500, 210, 260, 100, "H", "HOOK", "intercepta evento", C.blue, C.blueFill, {
    iconSize: 52, textX: 90, titleY: 20, subtitleY: 58, titleSize: 20, subtitleSize: 14,
  });
  iconBox(e, "policy", 880, 210, 300, 100, "P", "POLÍTICA", "decisão fora do modelo", C.orange, C.orangeFill, {
    iconSize: 52, textX: 90, titleY: 20, subtitleY: 58, titleSize: 20, subtitleSize: 14,
  });
  e.push(arrow("model-hook", 392, 260, 488, 260, { strokeColor: C.ink, strokeWidth: 3 }));
  e.push(arrow("hook-policy", 772, 260, 868, 260, { strokeColor: C.ink, strokeWidth: 3 }));
  pill(e, "allow", 1300, 195, 150, "ALLOW", C.green, C.greenFill, { fontSize: 17 });
  pill(e, "ask", 1470, 195, 150, "ASK", C.orange, C.orangeFill, { fontSize: 17 });
  pill(e, "deny", 1385, 268, 150, "DENY", C.red, C.redFill, { fontSize: 17 });
  e.push(arrow("policy-outcomes", 1192, 260, 1288, 260, { strokeColor: C.ink, strokeWidth: 3 }));

  const layers = [
    ["guide", "→", "GUIA", "orienta antes", "AGENTS.md · skill · ADR\ncontext map", C.purple, C.purpleFill],
    ["sensor", "◎", "SENSOR", "observa e devolve sinal", "test · lint · typecheck\ntelemetria · visão", C.blue, C.blueFill],
    ["gate", "▣", "GATE", "permite, pede ou nega", "CI obrigatório · policy\nbranch protection", C.green, C.greenFill],
  ];
  const layerX = [95, 670, 1245];
  layers.forEach(([id, symbol, titleValue, subtitleValue, examples, color, fill], i) => {
    e.push(rect(id, layerX[i], 405, 420, 245, { strokeColor: color, backgroundColor: fill, strokeWidth: 3 }));
    iconBadge(e, id + "-icon", layerX[i] + 25, 440, 64, symbol, color, C.white, { fontSize: 24 });
    e.push(text(id + "-title", layerX[i] + 115, 435, titleValue, { fontSize: 27, color }));
    e.push(text(id + "-subtitle", layerX[i] + 115, 480, subtitleValue, { fontSize: 17, color: C.ink }));
    e.push(centeredText(id + "-examples", layerX[i], 555, 420, examples, { fontSize: 16, color: C.muted }));
    if (i < layers.length - 1) {
      e.push(arrow(id + "-next", layerX[i] + 432, 528, layerX[i + 1] - 12, 528, { strokeColor: C.ink, strokeWidth: 2 }));
    }
  });

  e.push(text("surfaces-label", 95, 710, "SUPERFÍCIES DE RISCO", { fontSize: 18, color: C.ink }));
  const surfaces = [
    ["shell", "$", "SHELL", "destruição · segredo"],
    ["files", "F", "ARQUIVOS", "teste · política"],
    ["git", "G", "GIT", "histórico · publicação"],
    ["agents", "A", "SUBAGENTES", "cascata · custo"],
  ];
  const surfaceX = [95, 510, 925, 1340];
  surfaces.forEach(([id, symbol, titleValue, subtitleValue], i) => {
    iconBox(e, id, surfaceX[i], 760, 325, 100, symbol, titleValue, subtitleValue, C.red, C.white, {
      iconSize: 48, textX: 82, titleY: 18, subtitleY: 56, titleSize: 19, subtitleSize: 14,
    });
  });

  e.push(rect("authority", 180, 930, 1400, 95, { strokeColor: C.ink, backgroundColor: C.grayFill }));
  pill(e, "floor", 220, 953, 300, "FLOOR · NÃO DESLIGA", C.red, C.white, { fontSize: 15 });
  pill(e, "always", 730, 953, 300, "INTEGRIDADE · SEMPRE", C.orange, C.white, { fontSize: 15 });
  pill(e, "rails", 1240, 953, 300, "RAILS · CONFIGURÁVEIS", C.green, C.white, { fontSize: 15 });
});

scene("11-review-em-camadas", 1650, 1000, (e, w) => {
  heading(e, "Review em camadas", "Checks determinísticos primeiro; lentes independentes depois; ruído sob controle", w);

  const centerX = 825;
  const centerY = 520;
  const lensCenters = [
    [275, 310], [825, 270], [1375, 310],
    [275, 700], [825, 750], [1375, 700],
  ];
  lensCenters.forEach(([x, y], i) => {
    e.push(line("lens-line-" + i, centerX, centerY, x, y, { strokeColor: C.muted, strokeStyle: "dashed", strokeWidth: 2 }));
  });

  iconBox(e, "security", 90, 245, 370, 125, "!", "SEGURANÇA", "exploração viável?", C.red, C.redFill, {
    iconSize: 52, textX: 90, titleY: 24, subtitleY: 70, titleSize: 21, subtitleSize: 15,
  });
  iconBox(e, "requirements", 640, 205, 370, 125, "R", "REQUISITOS", "tudo foi entregue?", C.orange, C.orangeFill, {
    iconSize: 52, textX: 90, titleY: 24, subtitleY: 70, titleSize: 21, subtitleSize: 15,
  });
  iconBox(e, "tests", 1190, 245, 370, 125, "✓", "TESTES", "cobrem e discriminam?", C.blue, C.blueFill, {
    iconSize: 52, textX: 90, titleY: 24, subtitleY: 70, titleSize: 21, subtitleSize: 15,
  });
  iconBox(e, "architecture", 90, 635, 370, 125, "A", "ARQUITETURA", "padrão novo sem decisão?", C.purple, C.purpleFill, {
    iconSize: 52, textX: 90, titleY: 24, subtitleY: 70, titleSize: 21, subtitleSize: 15,
  });
  iconBox(e, "regression", 640, 685, 370, 125, "↻", "REGRESSÃO", "mudança sem relação?", C.purple, C.white, {
    iconSize: 52, textX: 90, titleY: 24, subtitleY: 70, titleSize: 21, subtitleSize: 15,
  });
  iconBox(e, "performance", 1190, 635, 370, 125, "P", "PERFORMANCE", "regressão óbvia?", C.green, C.greenFill, {
    iconSize: 52, textX: 90, titleY: 24, subtitleY: 70, titleSize: 21, subtitleSize: 15,
  });

  e.push(rect("review-center", 620, 420, 410, 200, { strokeColor: C.ink, backgroundColor: C.white, strokeWidth: 4 }));
  iconBadge(e, "review-center-icon", 790, 445, 70, "PR", C.ink, C.grayFill, { fontSize: 20 });
  e.push(centeredText("review-center-title", 620, 530, 410, "DIFF + EVIDÊNCIA", { fontSize: 26, color: C.ink }));
  e.push(centeredText("review-center-subtitle", 620, 573, 410, "lint · types · testes antes do juízo", { fontSize: 16, color: C.muted }));

  e.push(text("severity-label", 125, 875, "SEVERIDADE E ORÇAMENTO DE RUÍDO", { fontSize: 17, color: C.ink }));
  pill(e, "blocker", 125, 915, 300, "BLOCKER · IMPEDE MERGE", C.red, C.redFill, { fontSize: 14 });
  pill(e, "should-fix", 490, 915, 300, "SHOULD-FIX · DEFEITO", C.orange, C.orangeFill, { fontSize: 14 });
  pill(e, "nit", 855, 915, 300, "NIT · COM TETO", C.blue, C.blueFill, { fontSize: 14 });
  pill(e, "existing", 1220, 915, 300, "PRÉ-EXISTENTE · RESUMO", C.muted, C.grayFill, { fontSize: 14 });
});

console.log("Generated 11 editable Excalidraw scenes in", OUT);
