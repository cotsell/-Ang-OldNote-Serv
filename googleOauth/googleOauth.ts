import * as request from 'request';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';

export class google {
    private ACCESS_TOKEN = 'access_token';
    private REFRESH_TOKEN = 'refresh_token';
    private TOKEN_TYPE = 'token_type';
    private EXPIRES_IN = 'expires_in';
    private ID_TOKEN = 'id_token';

    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: string;
    idToken: string;

    constructor(json: any) {
        this.accessToken = json[this.ACCESS_TOKEN];
        this.refreshToken = json[this.REFRESH_TOKEN];
        this.tokenType = json[this.TOKEN_TYPE];
        this.expiresIn = json[this.EXPIRES_IN];
        this.idToken = json[this.ID_TOKEN];
        //return this;
    }

    getAccessToken(): string { return this.accessToken; }
    getRefreshToken(): string { return this.refreshToken; }
    getTokenType(): string { return this.tokenType; }
    getExpiresIn(): string { return this.expiresIn; }
    getIdToken(): string { return this.idToken; }
}

export class googleOauth {
    private clientId: string;
    private clientSecret: string;
    private redirectURLDecode: string;
    private redirectURLEncode: string;

    // 구글에 로그인 하거나 사용자에게 클라이언트의 접근 권한을 요청할때
    // 사용하는 url과 query를 갖고 있는 객체.
    private googleOauth = {
        AddressBasic: 'https://accounts.google.com/o/oauth2/v2/auth?',
        Scope: 'scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email',
        AccessType: 'access_type=offline',
        IncludeGrantedScopes: 'include_granted_scopes=true',
        State: 'state=state_parameter_passthrough_value',
        RedirectURI: 'redirect_uri=',
        ResponseType: 'response_type=code',
        ClientID: 'client_id='
    };

    constructor(clientId, clientSecret, redirectURLDecode, redirectURLEncode) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectURLDecode = redirectURLDecode;
        this.redirectURLEncode = redirectURLEncode;
    }

    // 구글에 접속하기 위해 필요한 URL과 query를 형태에 맞게 조립해서 리턴해줍니다.
    getGoogleOauthURL(): string {
        let go = this.googleOauth;
        let url = go.AddressBasic 
        + go.Scope + '&' 
        + go.AccessType + '&' 
        + go.IncludeGrantedScopes + '&' 
        + go.State + '&' 
        + go.RedirectURI + this.redirectURLEncode + '&' 
        + go.ResponseType + '&' 
        + go.ClientID + this.clientId;

        return url;
    }

    // 구글로그인 이후 리다이렉트로 받은 'Code'를 가지고,
    // 구글에게 AccessToken등으로 교환을 요청하는 내용의 Promise를 리턴.
    getGoogleAccessToken(code: string): Promise<google> {
        return new Promise((respond, rej) => {
            request.post(
                { url: 'https://www.googleapis.com/oauth2/v4/token',
                    form: {
                        code: code,
                        client_id: this.clientId,
                        client_secret: this.clientSecret,
                        redirect_uri: this.redirectURLDecode,
                        grant_type: 'authorization_code'
                    }
                },
                (err, res, body) => {
                    console.log('googleOauth.ts: getGoogleAccessToken(): error: ', err);
                    console.log('googleOauth.ts: getGoogleAccessToken(): statusCode: ', res && res.statusCode);
                    // console.log('googleOauth.ts: getGoogleAccessToken(): body: ', body);

                    respond(new google(JSON.parse(body)));
                }
            );
        });
    }

     //AccessToken으로 해당 유저의 프로필을 가져오는 내용의 Observable을 리턴.
     getUserProfile(access_token: string): Promise<any> {
        return new Promise((respond, rej) => {
            const url = 'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses&access_token=' + access_token;

            request(url, (err, res, body) => {
                console.log('googleOauth.ts: getUserProfile(): error: ', err);
                console.log('googleOauth.ts: getUserProfile(): statusCode: ', res && res.statusCode);
                // console.log('googleOauth.ts: getUserProfile(): body: ', body);

                respond(JSON.parse(body));
            });
        });
    }

    // 기본적으로 내장되어있는거 말고 다른거 쓸 경우를 위해서.
    setClientID(ClientID: string) {
        this.clientId = ClientID;
    }

    // 기본적으로 내장되어있는거 말고 다른거 쓸 경우를 위해서.
    setClientSecret(ClientSecret: string) {
        this.clientSecret = ClientSecret;
    }
}