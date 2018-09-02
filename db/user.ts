import * as mongoose from 'mongoose';
import { google } from '../googleOauth/googleOauth';
import { sysConf } from '../config/sysConfig';

export class user {
    Schema: mongoose.Schema;

    constructor() {
        this.setSchema();
    }

    getModel(): mongoose.Model<mongoose.Document> {
        return mongoose.model('user', this.Schema);
    }

    setSchema() {
        this.Schema = new mongoose.Schema({
            id: { type: String, required: true, unique: true, lowercase: true },
            password: { type: String, lowercase: true },
            display_name: { type: String, required: true },
            account_div: { type: Number, required: true },
            access_token: { type: String },
            refresh_token: { type: String }
        });

        this.Schema.statics['findOneByUserName'] = function(userId: string): Promise<mongoose.Document> {
            return this['find']({ id: userId });
        }

        this.Schema.statics['insertGoogleUserSignInfo'] = function(google: google): Promise<mongoose.Document> {
            let emailAddress = google.getUserProfile().getEmailAddress();
            let displayName = google.getUserProfile().getDisplayName();
            let accessToken = google.getAccessToken();
            let refreshToken = google.getRefreshToken() || ''; // TODO :: 일단은 이렇게 처리했지만.. 수정 필요.
            let myDoc: mongoose.Document = new this(
                {
                    id: emailAddress,
                    display_name: displayName,
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    account_div: sysConf.ACCOUNT_DIV_GOOGLE
                });

            return myDoc.save();
        }

        this.Schema.statics['updateGoogleUserInfo'] = function(google: google): Promise<any> {
            return new Promise((respond, rej) => {
                this['update'](
                    { id: google.getUserProfile().getEmailAddress() },
                    { $set: { access_token: google.getAccessToken() } },
                    (err, raw) => {
                        respond(raw);
                    }
                );
                
                // 위는 모델에서 수정한거고, 아래는 다큐먼트에서 수정한건데..
                // 아래는 작동 안하고 있다. 사용법 찾아보고 수정해보자.
                // this['findOne'](google.getUserProfile().getEmailAddress())
                // .then((userDoc: mongoose.Document) => {
                //     userDoc.update({$set: { access_token: google.getAccessToken() }},
                //     {},
                //     (err, raw) => {
                //         respond(raw);
                //     });
                // });
            });
        }
    }
}