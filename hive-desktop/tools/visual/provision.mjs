// Visual-pass harness for the provisioning gate (docs/visual-validation.md).
//
// `boot.mjs` deliberately resolves every install/update stream to `done`
// immediately so it lands on the work UI — which means the preparation screens
// it flies past are exactly the ones no screenshot ever caught. This boots the
// same mock surface with the gate held OPEN and driven by hand:
//
//   window.__install.step('core', 'Installing BMad Core module')
//   window.__install.progress('added 214 packages in 12s')
//   window.__install.fail('npm ERR! network timeout')
//   window.__brain.step(...)   // the second stage
//
// Set `HIVE_THEME` ('dark' | 'light' | 'hive') and `HIVE_GATE`
// ('install' | 'update' | 'brain') before running.
async (page) => {
  const theme = globalThis.HIVE_THEME || 'dark'
  const gate = globalThis.HIVE_GATE || 'install'
  await page.context().clearCookies()
  await page.addInitScript(
    ({ theme, gate }) => {
      localStorage.setItem('hive.tourSeen', '1')
      localStorage.setItem('hive-desktop-theme', theme)

      const noop = () => {}
      const unsub = () => noop
      const ok = (v) => () => Promise.resolve(v)

      // A stream the console drives, instead of one that resolves instantly.
      const held = (name) => {
        const listeners = []
        window[name] = {
          step: (id, label) => listeners.forEach((cb) => cb({ type: 'step', id, label })),
          progress: (message) => listeners.forEach((cb) => cb({ type: 'progress', message })),
          fail: (message) => listeners.forEach((cb) => cb({ type: 'error', message })),
          done: () => listeners.forEach((cb) => cb({ type: 'done', ok: true }))
        }
        return (...args) => {
          const onEvent = args[args.length - 1]
          listeners.push(onEvent)
          return noop
        }
      }

      const brain = held('__brain')

      window.hive = {
        chooseWorkspace: ok('/ws'),
        getWorkspace: ok('/ws'),
        // `install` renders the config form first; the other two go straight
        // to the running scene.
        provisionState: ok(gate !== 'install'),
        isProvisioned: ok(gate !== 'install'),
        getRecentWorkspaces: ok([]),
        openExternal: ok(undefined),
        installBmad: held('__install'),
        updateBmad: held('__update'),
        secondBrain: {
          // ONE controller for both: `held()` re-plants `window.__brain` on
          // every call, so calling it twice left the console driving the
          // update stream while the gate (isProvisioned:false) had subscribed
          // to install — `__brain.fail()` did nothing.
          install: brain,
          update: brain,
          // `brain` reaches the second stage only after stage 1 resolves, so
          // the update stream auto-completes for that scenario.
          isProvisioned: ok(false),
          getVault: ok({ path: null, name: null, rawPending: 0 })
        },
        profile: {
          agents: ok([{ id: 'claude', label: 'Claude Code', available: true }]),
          getAgent: ok('claude'),
          setAgent: ok(undefined),
          getAgents: ok(['claude']),
          setAgents: ok(undefined),
          getRole: ok('dev'),
          setRole: ok(undefined),
          getUserName: ok('Gustavo'),
          setUserName: ok(undefined),
          roleActions: ok([])
        },
        workflows: { list: ok([]) },
        skills: { list: ok([]) },
        app: { info: ok({ version: '0.1.0', channel: 'stable' }), onUpdateEvent: unsub }
      }

      if (gate === 'brain') {
        // Resolve stage 1 as soon as it subscribes, so the scene under test is
        // the knowledge-base one.
        const passthrough = window.hive.updateBmad
        window.hive.updateBmad = (...args) => {
          const unsubscribe = passthrough(...args)
          setTimeout(() => window.__update.done(), 0)
          return unsubscribe
        }
      }
    },
    { theme, gate }
  )

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:8123/index.html')
  await page.waitForTimeout(800)
  return await page.evaluate(() => document.body.innerText.slice(0, 300))
}
