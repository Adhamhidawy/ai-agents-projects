# AI Agents Projects

Companion code and reproducible demos for articles about AI agents and developer tools.

Each article project has its own folder, source code, tests, setup instructions and documented limits. Start with a project's README to see what it does and how to try it.

## Projects

| Project | What it demonstrates | Get started |
| --- | --- | --- |
| Fix Loop Breaker | A Claude Code mod that records repeated test failures and holds the next matching retry after three failures. | [Source and guide](projects/fix-loop-breaker/README.md) |

## Get the code

```sh
git clone https://github.com/Adhamhidawy/ai-agents-projects.git
cd ai-agents-projects
```

Follow the setup instructions inside the project you want to use. Projects can have different tools and version requirements.

## Repository layout

```text
ai-agents-projects/
├── README.md
├── docs/
│   └── project-readme-template.md
└── projects/
    └── fix-loop-breaker/
        ├── README.md
        ├── VERIFICATION.md
        ├── .claude-plugin/
        ├── hooks/
        ├── types/
        ├── tests/
        └── demo/
```
