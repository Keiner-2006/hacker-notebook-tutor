# Graph Report - src  (2026-07-14)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 61 nodes · 159 edges · 10 communities (6 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Login.tsx
- App.tsx
- db.ts
- handleFirestoreError
- LabsManager.tsx
- EvaluationCenter.tsx
- NotebookItem
- Notebook
- TerminalChat.tsx
- types.ts

## God Nodes (most connected - your core abstractions)
1. `App()` - 16 edges
2. `handleFirestoreError()` - 14 edges
3. `Notebook` - 13 edges
4. `NotebookItem` - 9 edges
5. `saveUserHandleForId()` - 6 edges
6. `buildFirestoreUserKey()` - 5 edges
7. `Evaluation` - 5 edges
8. `Lab` - 5 edges
9. `EvaluationCenterProps` - 4 edges
10. `TerminalChatProps` - 4 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `addEvaluation()`  [EXTRACTED]
  App.tsx → lib/db.ts
- `App()` --calls--> `addNotebook()`  [EXTRACTED]
  App.tsx → lib/db.ts
- `App()` --calls--> `addNotebookItem()`  [EXTRACTED]
  App.tsx → lib/db.ts
- `App()` --calls--> `deleteLab()`  [EXTRACTED]
  App.tsx → lib/db.ts
- `App()` --calls--> `getLabs()`  [EXTRACTED]
  App.tsx → lib/db.ts

## Import Cycles
- None detected.

## Communities (10 total, 4 thin omitted)

### Community 0 - "Login.tsx"
Cohesion: 0.23
Nodes (9): Header(), HeaderProps, Login(), LoginProps, buildFirestoreUserKey(), saveUserHandleForId(), app, auth (+1 more)

### Community 1 - "App.tsx"
Cohesion: 0.33
Nodes (9): App(), addLab(), deleteNotebook(), deleteNotebookItem(), getEvaluations(), getNotebooks(), getSavedHandleForId(), migrateUserWorkspaceToEmailKey() (+1 more)

### Community 2 - "db.ts"
Cohesion: 0.29
Nodes (4): addNotebookItem(), deleteLab(), FirestoreErrorInfo, OperationType

### Community 3 - "handleFirestoreError"
Cohesion: 0.33
Nodes (6): addEvaluation(), addNotebook(), getLabs(), getNotebookItems(), handleFirestoreError(), updateNotebookItem()

### Community 4 - "LabsManager.tsx"
Cohesion: 0.50
Nodes (3): LabsManagerProps, Lab, Vulnerability

### Community 9 - "types.ts"
Cohesion: 0.50
Nodes (3): NotebookItemType, QuizQuestion, QuizQuestionType

## Knowledge Gaps
- **6 isolated node(s):** `HeaderProps`, `LoginProps`, `OperationType`, `FirestoreErrorInfo`, `app` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Notebook` connect `Notebook` to `App.tsx`, `db.ts`, `LabsManager.tsx`, `EvaluationCenter.tsx`, `NotebookItem`, `TerminalChat.tsx`, `types.ts`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `NotebookItem` connect `NotebookItem` to `App.tsx`, `db.ts`, `EvaluationCenter.tsx`, `TerminalChat.tsx`, `types.ts`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `saveUserHandleForId()` connect `Login.tsx` to `App.tsx`, `db.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `HeaderProps`, `LoginProps`, `OperationType` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._