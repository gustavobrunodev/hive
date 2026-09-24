export const meta = {
  name: 'benchmark-agentic-frameworks',
  description: 'Run one frozen benchmark stage across agentic-development frameworks, judge every run independently, and score it deterministically.',
  phases: ['Preflight', 'Execute', 'Judge', 'Score', 'Synthesize'],
}

const request = args || {}

if (!request.configPath) {
  throw new Error('args.configPath is required and must point to a committed benchmark config')
}

phase('Preflight')

const config = await agent(
  `Read the benchmark configuration at ${request.configPath} and validate it without changing any file.

This workflow runs exactly one stage per invocation. Reject the configuration unless all of these are true:
- stage is one of discovery, planning, implementation, verification, or review
- fixture, frozenInput, baseline, cleanScript, scoreScript, baseRepository, baseCommit, outputRoot, runnerModel, judgeModel, effort, and repetitions are present
- every path is absolute and exists
- baseCommit resolves in baseRepository and the working tree that owns the frozen artifacts is clean
- repetitions is an integer of at least 3
- at least two framework entries are enabled for this stage
- each enabled framework pins a version or commit and provides setup plus invocation instructions
- no required value contains TODO, CHANGEME, PIN_, or a placeholder angle bracket
- outputRoot has no prior results for this exact stage/config id

Do not infer or repair missing values. Return the normalized configuration and explicit errors.`,
  {
    label: 'Validate frozen benchmark configuration',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'ready', 'errors', 'configId', 'stage', 'fixture', 'frozenInput', 'baseline',
        'cleanScript', 'scoreScript', 'baseRepository', 'baseCommit', 'outputRoot',
        'runnerModel', 'judgeModel', 'effort', 'repetitions', 'frameworks',
      ],
      properties: {
        ready: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
        configId: { type: 'string' },
        stage: { type: 'string' },
        fixture: { type: 'string' },
        frozenInput: { type: 'string' },
        baseline: { type: 'string' },
        cleanScript: { type: 'string' },
        scoreScript: { type: 'string' },
        baseRepository: { type: 'string' },
        baseCommit: { type: 'string' },
        outputRoot: { type: 'string' },
        runnerModel: { type: 'string' },
        judgeModel: { type: 'string' },
        effort: { type: 'string' },
        repetitions: { type: 'integer' },
        frameworks: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'version', 'sourcePath', 'setup', 'invocation'],
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
              sourcePath: { type: 'string' },
              setup: { type: 'string' },
              invocation: { type: 'string' },
            },
          },
        },
      },
    },
  },
)

if (!config || !config.ready) {
  throw new Error(`Benchmark preflight failed: ${(config && config.errors || []).join('; ')}`)
}

const runSpecs = []
for (const framework of config.frameworks) {
  for (let repetition = 1; repetition <= config.repetitions; repetition += 1) {
    runSpecs.push({ framework, repetition })
  }
}

log(`Running ${runSpecs.length} isolated executions for stage ${config.stage}`)
phase('Execute')

const executions = await pipeline(runSpecs, spec =>
  agent(
    `Run one benchmark attempt. You are an implementer/producer, never the judge.

Frozen configuration:
- config id: ${config.configId}
- stage: ${config.stage}
- framework: ${spec.framework.name}
- pinned framework version: ${spec.framework.version}
- framework source: ${spec.framework.sourcePath}
- repetition: ${spec.repetition}
- base repository: ${config.baseRepository}
- base commit: ${config.baseCommit}
- fixture: ${config.fixture}
- frozen input: ${config.frozenInput}
- clean-session script: ${config.cleanScript}
- output root: ${config.outputRoot}

Create a unique isolated checkout at <outputRoot>/workspaces/<stage>/<framework>/run-<N> from exactly baseCommit. Run the clean-session script and prove the expected generated files, caches, dependencies, data, and previous result artifacts are absent before starting. Install/configure only this framework using these pinned instructions:

${spec.framework.setup}

Invoke it exactly this way:

${spec.framework.invocation}

Give the framework only the frozen input and fixture allowed for this stage. Do not read another framework's run. Do not judge quality. Preserve every produced artifact, transcript, command log, diff, commit, failure, user-question count, measured wall-clock time, and available token/cost telemetry under <outputRoot>/artifacts/<stage>/<framework>/run-<N>/. Write manifest.json there. If the framework requires an answer, use only the fixture's frozen stakeholder-oracle answers; missing answers are recorded as unresolved, never invented.`,
    {
      label: `${spec.framework.name} ${config.stage} run ${spec.repetition}`,
      model: config.runnerModel,
      effort: config.effort,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['framework', 'version', 'repetition', 'status', 'workspace', 'artifactDir', 'manifest', 'commit', 'errors'],
        properties: {
          framework: { type: 'string' },
          version: { type: 'string' },
          repetition: { type: 'integer' },
          status: { type: 'string', enum: ['complete', 'failed', 'partial'] },
          workspace: { type: 'string' },
          artifactDir: { type: 'string' },
          manifest: { type: 'string' },
          commit: { type: 'string' },
          errors: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  ),
)

phase('Judge')

const judgements = await pipeline(executions, run =>
  agent(
    `Judge one benchmark artifact. You are fresh-context and did not produce this run.

Read only:
- frozen baseline: ${config.baseline}
- frozen input: ${config.frozenInput}
- run workspace: ${run.workspace}
- run artifact directory: ${run.artifactDir}
- implementation commit: ${run.commit}

Evaluate every baseline check independently as true or false. A true result requires verified file:line evidence and the relevant snippet/assertion. A false result must record the searches performed. No partial credit. Do not compute scores or compare frameworks. Do not modify the implementation. Write the result JSON to ${config.outputRoot}/judgements/${config.stage}/${run.framework}/run-${run.repetition}.json using the baseline's result schema. Then return only its path and integrity counts.`,
    {
      label: `Judge ${run.framework} ${config.stage} run ${run.repetition}`,
      model: config.judgeModel,
      effort: config.effort,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['framework', 'repetition', 'resultFile', 'checksExpected', 'checksReported', 'evidenceMissing', 'errors'],
        properties: {
          framework: { type: 'string' },
          repetition: { type: 'integer' },
          resultFile: { type: 'string' },
          checksExpected: { type: 'integer' },
          checksReported: { type: 'integer' },
          evidenceMissing: { type: 'integer' },
          errors: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  ),
)

phase('Score')

const resultFiles = judgements.map(item => item.resultFile)
const score = await agent(
  `Run the deterministic scorer. Do not calculate or repair any score yourself.

Command shape:
mkdir -p ${JSON.stringify(`${config.outputRoot}/scores/${config.stage}`)}
python3 ${JSON.stringify(config.scoreScript)} --strict --json --markdown ${JSON.stringify(`${config.outputRoot}/scores/${config.stage}/report.md`)} --baseline ${JSON.stringify(config.baseline)} --results ${resultFiles.map(path => JSON.stringify(path)).join(' ')}

Capture stdout, stderr, and exit code. A non-zero exit is a failed benchmark integrity gate, not a result to reinterpret. Save the exact output under ${config.outputRoot}/scores/${config.stage}/. Return the saved path and exit code.`,
  {
    label: `Score ${config.stage} mechanically`,
    model: config.judgeModel,
    effort: 'low',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'exitCode', 'scoreFile', 'stderr'],
      properties: {
        status: { type: 'string', enum: ['complete', 'failed'] },
        exitCode: { type: 'integer' },
        scoreFile: { type: 'string' },
        stderr: { type: 'string' },
      },
    },
  },
)

phase('Synthesize')

const report = await agent(
  `Write the stage benchmark report without changing any score.

Inputs:
- config: ${request.configPath}
- deterministic score output: ${score.scoreFile}
- output root: ${config.outputRoot}
- stage: ${config.stage}

Read the run manifests, judgement files, and scorer output. Report mean and spread per framework, integrity failures, scope adherence, build/lint/typecheck/test gates, wall time, token/cost telemetry when actually available, human/oracle turns, and unscored observations. Keep scored and unscored findings visibly separate. State that a missing capability was excluded by eligibility rather than scored as zero. Write ${config.outputRoot}/reports/${config.stage}.md. Do not declare a universal winner; interpret only this stage and fixture.`,
  {
    label: `Synthesize ${config.stage} report`,
    model: config.judgeModel,
    effort: config.effort,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'reportFile', 'openQuestions'],
      properties: {
        status: { type: 'string', enum: ['complete', 'failed'] },
        reportFile: { type: 'string' },
        openQuestions: { type: 'array', items: { type: 'string' } },
      },
    },
  },
)

return { configId: config.configId, stage: config.stage, executions, judgements, score, report }
