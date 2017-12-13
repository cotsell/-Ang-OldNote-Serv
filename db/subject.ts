import * as mongoose from 'mongoose';
import { Mongo } from './mongo';

export class subject {
    Schema: mongoose.Schema;

    constructor() {
        this.setSchema();
    }

    getModel(): mongoose.Model<mongoose.Document> {
        return mongoose.model('subject', this.Schema);
    }

    setSchema() {
        this.Schema = new mongoose.Schema({
            wirter_id: { type: String, required: true}, //, unique: true, lowercase: true },
            project_id: { type: String, required: true },
            number: { type: Number, required: true },
            title: { type: String }
        });

        this.Schema.statics['getSubjectList'] = function (id: string): Promise<mongoose.Document> {
            return this['find']({ project_id: id });
        } 
    }
}