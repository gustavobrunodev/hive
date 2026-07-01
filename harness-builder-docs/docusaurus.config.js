// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Harness Builder',
  tagline: 'Skill para agentes de código — montar o harness do projeto e evoluí-lo conforme ele muda.',
  url: 'https://hive.zupinnovation.com.br',
  baseUrl: '/',
  favicon: 'img/favicon.ico',

  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'pt-BR',
    locales: ['pt-BR'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: false,
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: '',
        items: [],
      },
      metadata: [
        {
          name: 'description',
          content:
            'Skill instalável via HIVE CLI para qualquer agente de código. Monta o harness completo do projeto e evolui com ele.',
        },
      ],
    }),
};

export default config;
