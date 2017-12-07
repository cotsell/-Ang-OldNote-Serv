export class accountResult {
    msg: string;
    loginResult: boolean;
    key: string;

    constructor(msg: string, loginResult: boolean, key: string) {
        this.msg = msg;
        this.loginResult = loginResult;
        this.key = key;
    }

    getMsg(): string { return this.msg; }

    getLoginResult(): boolean { return this.loginResult; }

    getKey(): string { return this.key; }
}