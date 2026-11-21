// Agentes de IA de Nexo. Cada agente vive en su archivo, con su instrucción y su
// formato de salida a la vista. Todos llaman al modelo a través de src/lib/llm.ts.

export { mutateGenomeFromPrompt, type MutateGenomeOptions, type MutateGenomeResult } from "./mutate-genome";
export { runRoleAgentTurn, type RoleAgentContext, type RoleAgentTurn } from "./role-agent";
