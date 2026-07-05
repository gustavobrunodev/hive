import React from 'react';
import Layout from '@theme/Layout';
import { useColorMode } from '@docusaurus/theme-common';
import { useBaseUrlUtils } from '@docusaurus/useBaseUrl';
import '@hive/design-system/dist/ds-bundle.css';

import {
  HarnessMark,
  Button,
  DotsBackground,
  Reveal,
  Stagger,
  SectionHeading,
  ValueCard,
  Terminal,
  ModeSplit,
  ModeBlock,
  CaseCard,
  Flow,
  SpineLabel,
  Steps,
  Step,
  Substeps,
  Sub,
  Callout,
  SkillCard,
  SkillSpinePin,
  Table,
  Pkg,
  Stack,
  Cond,
  Badge,
  SteppedList,
  SteppedListItem,
  CodeBlock,
  Cor,
} from '@hive/design-system';

// ---- Theme Toggle ----
function ThemeToggle() {
  const { colorMode, setColorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  return (
    <button
      className="theme-toggle"
      onClick={() => setColorMode(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      {isDark ? '☀' : '☾'}
    </button>
  );
}

// ---- Custom Nav ----
function SiteNav() {
  return (
    <header className="hive-nav">
      <div className="hive-nav-inner">
        <a className="hive-nav-brand" href="#top">
          <HarnessMark variant="horizontal" size={32} />
        </a>
        <nav className="hive-nav-links" aria-label="Navegação principal">
          <a href="#quando-usar">Quando usar</a>
          <a href="#como-funciona">Playbook</a>
          <a href="#skills">Skills</a>
          <a href="#presets">Presets</a>
        </nav>
        <div className="hive-nav-actions">
          <ThemeToggle />
          <Button href="#instalar" className="hds-nav-cta">
            Instalar
          </Button>
        </div>
      </div>
    </header>
  );
}

// ---- Custom Footer ----
function SiteFooter() {
  return (
    <footer className="hive-footer">
      <div className="hive-ft-inner">
        <div className="hive-ft-top">
          <div className="hive-ft-brand">
            <HarnessMark variant="horizontal" size={30} />
          </div>
          <p className="hive-ft-tag">
            Skill para agentes de código — montar o harness do projeto e evoluí-lo conforme ele
            muda.
          </p>
        </div>
        <div className="hive-ft-bottom">
          <span>@zupinnovation</span>
          <span>Agent skill · harness-builder</span>
          <a href="https://zup.com.br">zup.com.br</a>
        </div>
      </div>
    </footer>
  );
}

// ---- Agent marks ----
function IconMore() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const AGENTS = [
  { id: 'claude', label: 'Claude', img: 'img/agents/claude.png' },
  { id: 'cursor', label: 'Cursor', img: 'img/agents/cursor.png' },
  { id: 'copilot', label: 'GitHub Copilot', img: 'img/agents/github-copilot.svg' },
  { id: 'devin', label: 'Devin', img: 'img/agents/devin.svg' },
  { id: 'mais', label: '+ outros agentes', Icon: IconMore },
];

function AgentMarks() {
  const { withBaseUrl } = useBaseUrlUtils();
  return (
    <div className="hive-hero-agents">
      <span className="hive-hero-agents-label">Funciona com</span>
      <ul className="hive-hero-agents-list" aria-label="Agentes de código compatíveis">
        {AGENTS.map(({ id, label, img, Icon }) => (
          <li key={id} className="hive-hero-agent" data-tooltip={label} tabIndex={0} aria-label={label}>
            <span className="hive-hero-agent-mark">
              {img ? <img src={withBaseUrl(img)} alt="" width={18} height={18} loading="lazy" /> : <Icon />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Hero ----
function HeroSection() {
  return (
    <section className="hive-hero" id="top">
      <DotsBackground />
      <div className="wrap hive-hero-inner">
        <div className="hive-hero-copy">
          <span className="hive-hero-tag cut-sm">
            Agent skill <b>· harness-builder</b>
          </span>
          <h1>
            Construa o <em>harness completo</em> dos seus projetos com uma skill.
          </h1>
          <p className="hive-hero-sub">
            O Harness Builder é uma skill única, instalável em qualquer agente de código, que
            orquestra quatro módulos de referência para criar e evoluir rules, sensores e skills de
            qualquer projeto — guiada por harness engineering e avessa a overengineering.
          </p>
          <div className="hive-hero-cta-row">
            <Button href="#instalar" arrow>
              Instalar agora
            </Button>
            <Button variant="ghost" href="#como-funciona">
              Ver como funciona
            </Button>
          </div>
          <div className="hive-hero-meta" aria-label="Destaques">
            <span>
              <i className="dot" aria-hidden="true" />4 módulos de referência
            </span>
            <span>
              <i className="dot" aria-hidden="true" />6 fases, 1 skill
            </span>
          </div>
          <AgentMarks />
        </div>

        <Reveal className="hive-hero-visual">
          <Terminal
            title="agent · projeto-da-squad"
            command="Avalie e melhore o harness deste projeto"
            output="Avaliando o harness atual e mapeando lacunas antes de mudar qualquer arquivo…"
            phases={[
              { label: '0 · Orientar', active: true },
              { label: '1 · Avaliar', active: true },
              { label: '2 · Rules', active: false },
              { label: '3 · Skills', active: false },
              { label: '4 · Sensores', active: false },
              { label: '5 · Steering', active: false },
            ]}
          />
        </Reveal>
      </div>
    </section>
  );
}

// ---- Value ----
function ValueSection() {
  return (
    <section className="section-pad" id="o-que-e" aria-labelledby="val-h">
      <div className="wrap">
        <Reveal>
          <SectionHeading eyebrow="O que é" id="val-h" lead="Harness é o conjunto de controles que faz o agente acertar mais na primeira tentativa e se autocorrigir no resto: guides orientam antes de agir, sensors dão feedback depois. O Harness Builder monta esse sistema seguindo um princípio só.">
            Um harness preciso, não um harness grande
          </SectionHeading>
        </Reveal>
        <Stagger className="hds-val-grid">
          <ValueCard
            kicker="Guiado por harness engineering"
            title="A harness-engineer é a espinha"
            index={0}
          >
            O módulo harness-engineer avalia o projeto e decide o que realmente precisa antes de
            tocar em qualquer arquivo. Os outros módulos entram a serviço dele.
          </ValueCard>
          <ValueCard
            kicker="Sem overengineering"
            title="Cada controle merece seu lugar"
            index={1}
          >
            Toda rule, sensor e skill precisa atacar uma falha real e observada. Na dúvida, o
            playbook refina ou remove; nunca acumula ruído.
          </ValueCard>
          <ValueCard
            kicker="Evolui com o projeto"
            title="Harness não é evento único"
            index={2}
          >
            Nova biblioteca, MCP ou falha recorrente? A skill avalia se entra no harness — como
            rule, skill, sensor ou nada — sem acumular ruído.
          </ValueCard>
        </Stagger>
      </div>
    </section>
  );
}

// ---- When to Use ----
function WhenToUseSection() {
  const cases = [
    {
      tag: 'Nova integração',
      title: 'Biblioteca ou API nova no projeto',
      body: 'Avalia se entra no harness — rule em docs/, skill do ecossistema, MCP ou sensor — ou se o agente já infere do código.',
      prompt: 'Integrei o TanStack Query — faz sentido incluir no harness? Como rule, skill ou MCP?',
      mode: 'Modo Harness',
    },
    {
      tag: 'Falha recorrente',
      title: 'Agente erra sempre na mesma coisa',
      body: 'Identifica se falta guide (feedforward), sensor (feedback) ou os dois — e propõe o controle mínimo que resolve.',
      prompt: 'O agente ignora testes de integração — o que adicionar ao harness?',
      mode: 'Modo Harness',
    },
    {
      tag: 'MCP candidato',
      title: 'Novo MCP disponível',
      body: 'Julga se o MCP merece lugar no harness: cobre gap real, não duplica rule/skill existente, custo de manutenção compensa.',
      prompt: 'Vale conectar o MCP do Linear no harness deste repo?',
      mode: 'Modo Harness',
    },
    {
      tag: 'Rules',
      title: 'AGENTS.md desatualizado',
      body: 'Revisa, enxuga e reescreve rules sem rerodar o playbook inteiro. Aplica o teste de inferência: corta o que o agente já descobre sozinho.',
      prompt: 'Revisa o AGENTS.md — ficou grande e o agente ignora metade',
      mode: 'Modo Rules',
    },
    {
      tag: 'Capacidade nova',
      title: 'Buscar skill especializada',
      body: 'Procura no ecossistema, valida qualidade e instala só com seu aval — sem empilhar skills desnecessárias.',
      prompt: 'Tem skill de acessibilidade que valha para este projeto?',
      mode: 'Modo Find',
    },
    {
      tag: 'Stack mudou',
      title: 'Novo módulo ou framework',
      body: 'Detecta o stack, aplica os presets de ai-tools da org que faltam — skills e MCPs — e avalia lacunas restantes. Idempotente: só instala o que não existe.',
      prompt: 'Adicionamos backend .NET ao monorepo — quais presets faltam?',
      mode: 'Modo Presets',
    },
    {
      tag: 'Ruído',
      title: 'Controle que ninguém obedece',
      body: 'Diagnostica falso positivo, conflito com outro sensor ou timing errado. Prefere refinar ou remover a empilhar exceções.',
      prompt: 'O linter de arquitetura dispara demais — refino ou removo?',
      mode: 'Modo Harness',
    },
    {
      tag: 'Review piorou',
      title: 'PRs do agente precisam de mais revisão',
      body: 'Assessment focado: mapeia onde guides e sensors falharam, prioriza correções de alto leverage e fecha o steering loop.',
      prompt: 'Reviews de PR do agente pioraram — onde o harness está falhando?',
      mode: 'Modo Harness ou Full',
    },
  ];

  return (
    <section className="section-pad" id="quando-usar" aria-labelledby="use-h">
      <div className="wrap">
        <Reveal>
          <SectionHeading
            eyebrow="Quando usar"
            id="use-h"
            lead="O harness não termina na primeira entrega. A skill vive com o projeto — e responde tanto ao playbook completo quanto a pedidos pontuais conforme o contexto muda."
          >
            Setup inicial e evolução contínua
          </SectionHeading>
        </Reveal>

        <Reveal>
          <ModeSplit>
            <ModeBlock
              label="Primeira vez ou overhaul"
              title="Playbook completo"
              primary
              items={[
                'Projeto novo sem harness definido',
                'Revisão profunda depois de meses sem manutenção',
                'Squad quer padronizar rules, sensores e skills de uma vez',
              ]}
            >
              Seis fases guiadas: avalia o harness atual, prioriza com você, implementa só o que
              sobreviveu ao corte.
            </ModeBlock>
            <ModeBlock
              label="Dia a dia do projeto"
              title="Evolução do harness"
              items={[
                'Nova biblioteca, API ou integração entrou no código',
                'MCP, skill ou rule candidata — vale incluir?',
                'Agente repete o mesmo erro; sensor ou rule resolve?',
                'Controle existente virou ruído — refinar ou remover',
              ]}
            >
              Pedidos scoped: a skill carrega só o módulo necessário, avalia se a mudança merece
              lugar no harness e propõe o controle certo.
            </ModeBlock>
          </ModeSplit>
        </Reveal>

        <Stagger className="hds-cases">
          {cases.map((c, i) => (
            <CaseCard key={c.tag} tag={c.tag} title={c.title} prompt={c.prompt} mode={c.mode} index={i}>
              {c.body}
            </CaseCard>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

// ---- How It Works ----
function HowItWorksSection() {
  return (
    <section className="section-pad" id="como-funciona" aria-labelledby="flow-h">
      <div className="wrap">
        <Reveal>
          <SectionHeading
            eyebrow="Playbook completo"
            id="flow-h"
            lead="Quando o escopo é montar ou revisar o harness inteiro, a harness-engineer conduz o fluxo. Os demais módulos entram só para lacunas que a avaliação identificou — no dia a dia, pedidos pontuais usam um módulo só."
          >
            Seis fases para o setup inicial
          </SectionHeading>
        </Reveal>

        <Reveal>
          <Flow>
            <SpineLabel>
              Espinha do fluxo: <b>harness-engineer</b>
            </SpineLabel>
            <Steps>
              <Step
                number={0}
                title="Orientar"
                highlight
                skills={[{ label: 'harness-engineer', he: true }]}
              >
                <p>
                  Carrega o modelo mental: guides vs. sensors, custo computacional vs. inferencial,
                  categorias e timing. É o que mantém o resto do fluxo longe do overengineering.
                </p>
              </Step>

              <Step
                number={1}
                title="Avaliar"
                highlight
                skills={[{ label: 'harness-engineer', he: true }]}
              >
                <p>
                  Inventaria os controles atuais e mapeia direção, execução, categoria e timing,
                  produzindo o Harness Assessment com as lacunas priorizadas.
                </p>
                <Callout variant="gate">
                  Aprova as prioridades com você antes de alterar qualquer arquivo.
                </Callout>
              </Step>

              <Step
                number={2}
                title="Guides / Rules"
                skills={[{ label: 'agent-rules-architect', he: false }]}
              >
                <p>
                  Escreve um <code>AGENTS.md</code> mínimo e arquivos <code>docs/</code> sob
                  demanda, só para as lacunas de orientação que a avaliação encontrou.
                </p>
              </Step>

              <Step
                number={3}
                title="Skills"
                skills={[
                  { label: 'stack-presets', he: false },
                  { label: 'find-skills', he: false },
                ]}
              >
                <p>Primeiro os presets obrigatórios do stack — skills e MCPs; depois a descoberta de skills para o que sobrou.</p>
                <Substeps>
                  <Sub label="3a · Presets" skill="stack-presets">
                    Garante as ai-tools padrão do stack detectado — skills e MCPs —, instalando só o que falta.
                  </Sub>
                  <Sub label="3b · Lacunas" skill="find-skills">
                    Busca e valida skills do ecossistema para gaps reais que os presets não cobrem.
                  </Sub>
                </Substeps>
              </Step>

              <Step
                number={4}
                title="Sensores"
                highlight
                skills={[{ label: 'harness-engineer', he: true }]}
              >
                <p>
                  Liga sensores com mensagens de autocorreção e posiciona cada um pelo custo,
                  mantendo a qualidade o mais à esquerda possível. Bloqueia só onde compensa.
                </p>
              </Step>

              <Step
                number={5}
                title="Steering loop"
                highlight
                last
                skills={[{ label: 'harness-engineer', he: true }]}
              >
                <p>
                  Re-inventaria para confirmar a cobertura, documenta como evoluir o harness e
                  declara os limites honestos do que ele não cobre.
                </p>
              </Step>
            </Steps>
          </Flow>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Skills ----
function SkillsSection() {
  return (
    <section className="section-pad" id="skills" aria-labelledby="sk-h">
      <div className="wrap">
        <Reveal>
          <SectionHeading
            eyebrow="O que vem dentro"
            id="sk-h"
            lead="Cada módulo é uma cópia fiel da skill original, preservada em references/ para seguir independente. A harness-engineer é a única que decide; as outras três executam o que a avaliação dela pediu."
          >
            Quatro módulos, um maestro
          </SectionHeading>
        </Reveal>
        <Stagger className="hds-skills">
          <SkillCard role="Espinha" title="harness-engineer" lead index={0}>
            <p>
              Avalia o harness, classifica cada controle, define sensores e fecha o steering loop.
              Decide o que cada uma das outras skills faz e onde cada controle roda.
            </p>
            <SkillSpinePin drive={[0, 1, 4, 5]} delegate={[2, 3]} />
          </SkillCard>
          <SkillCard role="Guides" title="agent-rules-architect" index={1}>
            <p>
              Escreve e enxuga as rules: um <code>AGENTS.md</code> mínimo mais{' '}
              <code>docs/</code> progressivos, carregados só quando a tarefa precisa.
            </p>
          </SkillCard>
          <SkillCard role="Presets" title="stack-presets" index={2}>
            <p>
              Ai-tools obrigatórias da organização por stack — skills e MCPs. Progressivo (lê só a
              referência do stack) e idempotente (instala só o que falta).
            </p>
          </SkillCard>
          <SkillCard role="Lacunas" title="find-skills" index={3}>
            <p>
              Descobre e valida skills do ecossistema aberto para gaps reais que uma baseline ou
              rule não resolve melhor.
            </p>
          </SkillCard>
        </Stagger>
      </div>
    </section>
  );
}

// ---- Presets ----
function BaselinesSection() {
  return (
    <section className="section-pad" id="presets" aria-labelledby="bl-h">
      <div className="wrap">
        <Reveal>
          <SectionHeading
            eyebrow="Fase 3a"
            id="bl-h"
            lead="A skill garante as ai-tools padrão da organização conforme o stack detectado — skills e MCPs —, instalando somente o que ainda falta no projeto."
          >
            Presets por stack
          </SectionHeading>
        </Reveal>
        <Reveal>
          <Table>
            <thead>
              <tr>
                <th scope="col">Quando</th>
                <th scope="col">Skills baseline</th>
                <th scope="col">MCPs baseline</th>
                <th scope="col">Condição</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <Stack>Qualquer projeto</Stack>
                </td>
                <td>
                  <Pkg>tlc-spec-driven</Pkg>
                </td>
                <td>
                  <Cond>—</Cond>
                </td>
                <td>
                  <Cond>Só se não houver ferramenta de SDD no projeto</Cond>
                </td>
              </tr>
              <tr>
                <td>
                  <Stack>Frontend React</Stack>
                </td>
                <td>
                  <Pkg>vercel-react-best-practices</Pkg>
                  <Cond> + testing/perf sob gap</Cond>
                </td>
                <td>
                  <Pkg>Figma</Pkg> · <Pkg>Playwright</Pkg> · <Pkg>Chrome DevTools</Pkg>
                </td>
                <td>
                  <Cond>Se não existir no projeto</Cond>
                </td>
              </tr>
              <tr>
                <td>
                  <Stack>Frontend Angular</Stack>
                </td>
                <td>
                  <Pkg>angular-developer</Pkg>
                  <Badge>oficial</Badge>
                  <Cond> + testing/perf sob gap</Cond>
                </td>
                <td>
                  <Pkg>Figma</Pkg> · <Pkg>Playwright</Pkg> · <Pkg>Chrome DevTools</Pkg>
                </td>
                <td>
                  <Cond>Se não existir no projeto</Cond>
                </td>
              </tr>
              <tr>
                <td>
                  <Stack>Backend .NET / C#</Stack>
                </td>
                <td>
                  <Pkg>dotnet-best-practices</Pkg>
                  <Cond> + testing/perf sob gap</Cond>
                </td>
                <td>
                  <Cond>— (set de MCP é só frontend)</Cond>
                </td>
                <td>
                  <Cond>Se não existir no projeto</Cond>
                </td>
              </tr>
            </tbody>
          </Table>
        </Reveal>
        <Reveal>
          <Callout>
            Preset não é harness template: o preset é o piso de tooling por <em>stack</em>
            (skills + MCPs). Um harness template amarra guides e sensores a uma{' '}
            <em>topologia</em> de serviço — outro eixo, outro escopo.
          </Callout>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Install ----
function InstallSection() {
  return (
    <section className="section-pad" id="instalar" aria-labelledby="in-h">
      <div className="wrap">
        <Reveal>
          <SectionHeading
            eyebrow="Mãos à obra"
            id="in-h"
            lead="Instale em segundos com a HIVE CLI. A skill funciona em qualquer agente de código — Cursor, Claude, Copilot, Devin e outros."
          >
            Como instalar
          </SectionHeading>
        </Reveal>

        <Reveal>
          <div className="hive-install-single">
            <SteppedList>
              <SteppedListItem title="Instale via HIVE CLI" description="Um comando instala a skill no agente que você usa.">
                <CodeBlock copyText="npx @hive/cli install -s harness-builder">
                  <Cor>npx @hive/cli install</Cor> -s harness-builder
                </CodeBlock>
              </SteppedListItem>
              <SteppedListItem title="Mantenha atualizado" description="Rode quando houver uma nova versão da skill.">
                <CodeBlock copyText="npx @hive/cli update -s harness-builder">
                  <Cor>npx @hive/cli update</Cor> -s harness-builder
                </CodeBlock>
              </SteppedListItem>
            </SteppedList>
            <div className="hive-agent-row" aria-label="Agentes compatíveis">
              {['Cursor', 'Claude', 'Copilot', 'Devin', '+ outros'].map((a) => (
                <span key={a} className="hive-agent-chip">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Closing ----
function ClosingSection() {
  return (
    <section className="hive-closing section-pad" aria-labelledby="cl-h">
      <DotsBackground />
      <div className="wrap">
        <Reveal>
          <span className="hds-eyebrow">O princípio</span>
          <h2 id="cl-h">Menos retrabalho, mais precisão</h2>
          <p className="hive-cl-lead">
            Um harness que dispara ruído que ninguém trata é pior do que um menor em que o agente
            confia. Por isso cada controle precisa merecer seu lugar — no setup e em cada evolução
            — e a skill sempre prefere refinar a acumular.
          </p>
          <Callout cut>
            Sensores verificam forma e pegam regressões, não verificam intenção. O harness
            redireciona a atenção humana para onde ela importa; não a elimina.
          </Callout>
          <div className="hive-cta-row">
            <Button href="#instalar" arrow>
              Instalar o Harness Builder
            </Button>
            <Button variant="ghost" href="#quando-usar">
              Ver casos de uso
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Page ----
export default function Home() {
  return (
    <Layout
      title="Harness Builder — skill para o harness completo dos seus projetos"
      description="Skill instalável via HIVE CLI para qualquer agente de código. Monta o harness completo do projeto e evolui com ele."
      noFooter
      wrapperClassName="hive-page"
    >
      <a className="skip" href="#main">
        Pular para o conteúdo
      </a>
      <SiteNav />
      <main id="main">
        <HeroSection />
        <ValueSection />
        <WhenToUseSection />
        <HowItWorksSection />
        <SkillsSection />
        <BaselinesSection />
        <InstallSection />
        <ClosingSection />
      </main>
      <SiteFooter />
    </Layout>
  );
}
