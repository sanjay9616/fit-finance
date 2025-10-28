export const SPLITWISE_DEFAULTS = {
    CATEGORIES: {
        SPLIT_EXPENSE: {
            expenseName: (groupName: string) => `Split Expense - ${groupName}`,
            categoryName: "Split Expense",
            expenseDescription: (title: string, groupName: string) => `${title} — You spent in "${groupName}"`,
            goalDescription: "Default goal for tracking all your expenses made through Splitwise"
        },
        SETTLEMENT_PAID: {
            expenseName: (groupName: string) => `Settlement Paid - ${groupName}`,
            categoryName: "Settlement Paid",
            expenseDescription: (userName: string, groupName: string) => `You paid ${userName} in "${groupName}"`,
            goalDescription: "Default goal for tracking planned settlements (payments) in Splitwise"
        },
        SETTLEMENT_RECEIVED: {
            expenseName: (groupName: string) => `Settlement Received - ${groupName}`,
            categoryName: "Settlement Received",
            expenseDescription: (userName: string, groupName: string) => `You received from ${userName} in "${groupName}"`,
            goalDescription: "Default goal for tracking expected settlements (receipts) in Splitwise"
        }
    }
};