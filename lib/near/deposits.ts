/** Storage deposit estimate passed with create_group; any surplus is refunded. */
export const CREATE_GROUP_DEPOSIT = "500000000000000000000000"

/** P0 Convert runbook deposit. */
export const CONVERT_DEPOSIT = "10000000000000000000000000" // 10N — live contract still at 10 until redeploy; source 6cec97d said 5

/** Extra separation: one group write, one Convert, and no implicit sweeps. */
export const JOIN_AMOUNT_DEFAULT = "1000000"
