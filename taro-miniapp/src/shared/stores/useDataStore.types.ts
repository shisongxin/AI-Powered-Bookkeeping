export interface DataState {
  /** 账单数据版本号 — 每次增删改后 +1 */
  billsVersion: number
  /** 触发账单数据重新加载 */
  bumpBillsVersion: () => void
}
