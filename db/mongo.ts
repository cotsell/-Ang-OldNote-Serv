import * as mongoose from 'mongoose';
import { project } from './project';
import { subject } from './subject';
import { user } from './user';
import { item } from './item';

// 여러군데의 DB에 접속할 경우가 발생할 수 있으므로,
// 싱글턴으로 가지는 않기로 함.
export class Mongo {
    db: mongoose.Connection;
    user: user;
    project: project;
    subject: subject;
    item: item;
        
    constructor(url: string) {
        this.setConnectMongoDB(url);
        mongoose.connection.on('disconnected', this.setConnectMongoDB);
        this.setSchemas();
    }

    // DB에 접속.
    setConnectMongoDB(url: string) {
        // mongoose.Promise = global.Promise;
        this.db = mongoose.connection;
        this.db.on('error', console.error);
        this.db.once('open', () => { console.log('Connected to mongoDB.') });
        mongoose.connect(url);
    }

    setSchemas() {
        this.user = new user();
        this.project = new project();
        this.subject = new subject();
        this.item = new item();
    }

    getUser(): mongoose.Model<mongoose.Document> {
        return this.user.getModel();
    }

    getProject(): mongoose.Model<mongoose.Document> {
        return this.project.getModel();
    }

    getSubject(): mongoose.Model<mongoose.Document> {
        return this.subject.getModel();
    }

    getItem(): mongoose.Model<mongoose.Document> {
        return this.item.getModel();
    }
}