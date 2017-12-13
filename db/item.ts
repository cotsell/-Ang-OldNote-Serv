import * as mongoose from 'mongoose';
import { Mongo } from './mongo';

export class item {
    Schema: mongoose.Schema;

    constructor() {
        this.setSchema();
    }

    getModel(): mongoose.Model<mongoose.Document> {
        return mongoose.model('item', this.Schema);
    }

    setSchema() {
        this.Schema = new mongoose.Schema({
            writer_id: { type: String, required: true},// unique: true, lowercase: true },
            subject_id: { type: String, required: true },
            number: { type: Number, required: true },
            title: { type: String },
            text: { type: String }
        });

        this.Schema.statics['getItemList'] = function(ids: any[]) {
            const conditions = {$or:[]};
            for(let i = 0; i < ids.length; i++) {
                conditions['$or'].push({subject_id: ids[i]});
            }
            return this['find'](conditions);
        }
    }
}