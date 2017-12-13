export class accountResult {
    msg: string;
    loginResult: boolean;
    key: string;
    user_info: any;

    constructor(msg: string, loginResult: boolean, key: string, user_info?: any) {
        this.msg = msg;
        this.loginResult = loginResult;
        this.key = key;
        if( user_info !== undefined && user_info !== null) {
            this.user_info = {
                id: user_info['id'],
                display_name: user_info['display_name']
            };
        }
    }

    getMsg(): string { return this.msg; }

    getLoginResult(): boolean { return this.loginResult; }

    getKey(): string { return this.key; }

    getUserInfo(): any {
        return this.user_info;
    }

    setUserInfo(userInfo: any) {
        this.user_info = userInfo;
    }
}