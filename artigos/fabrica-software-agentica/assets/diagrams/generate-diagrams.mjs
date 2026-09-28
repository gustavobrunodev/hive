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

console.log("Generated 5 editable Excalidraw scenes in", OUT);
