export const MESSAGE = {
    SUCCESS: {
        USER_CREATED: "User created. Verification email sent.",
        ACCOUNT_VERIFIED: "Your account has been verified successfully!",
        ACCOUNT_LOGGED_IN: 'Logged in successfully',
        SESSION_TOKEN_VALIDATED: 'Session validated successfully',
        EXPENSE_ADDED: 'Expense added successfully',
        EXPENSE_FETCHED: 'Your expenses have been fetched.',
        EXPENSE_UPDATED: 'Expense updated successfully',
        EXPENSE_DELETED: 'Expense deleted successfully',
    },
    ERROR: {
        SOMETHING_WENT_WRONG: 'Something Went Wrong',
        USER_NOT_FOUND: 'Account does not exist. Please register to continue.',
        INVALID_ACCOUNT_PASSWORD: 'Incorrect password. Please try again.',
        INVALID_TOKEN_LINK: 'Verification failed. Invalid or expired verification link.',
        ACCOUNT_NOT_VERIFIED: 'Account not verified. Please check your email...',
        SESSION_TOKEN_MISSING: 'Session token is missing. Please log in again.',
        SESSION_TOKEN_INVALID: 'Invalid or unrecognized session. Please log in again.',
        SESSION_TOKEN_EXPIRED: 'Session expired. Please log in again to continue.',
        EXPANSE_NOT_FOUND: 'No matching expense found. Please try again.',
    }
}