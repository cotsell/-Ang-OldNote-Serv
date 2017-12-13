export class sysConf {
    // Client
    static CLIENT_ADDRESS = 'http://localhost:4200';

    // Server
    static HTTP_SERVER_PORT = 8000;
    static WEBSOCKET_SERVER_PORT = 8100; 

    // DB
    static DB_URL = 'mongodb://localhost:27017/test';
    static ACCOUNT_DIV_DIRECT = 0;
    static ACCOUNT_DIV_GOOGLE = 1;

    // Account
    static JWT_SECRET = 'gkwlakqkqhdi';

    //google Oauth
    static CLIENT_ID = '843811278772-0i07uc720dumic2ge71hpf644ue83mj8.apps.googleusercontent.com';
    static CLIENT_SECRET = 'L8j8V6SSW4JyYzbzdEM_0Sqo';
    static REDIRECT_URL_ENCODE = 'http%3A%2F%2Flocalhost%3A8000%2Faccount%2Fsign%2Fgoogle%2Fredirect';
    static REDIRECT_URL_DECODE = 'http://localhost:8000/account/sign/google/redirect';
}

