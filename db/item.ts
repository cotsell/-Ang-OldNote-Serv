import * as mongoose from 'mongoose';
import { Mongo } from './mongo';
import { IItem } from '../Interface';

export class item {
    Schema: mongoose.Schema;

    constructor() {
        this.setSchema();
    }

    getModel(): mongoose.Model<mongoose.Document> {
        return mongoose.model('item', this.Schema);
    }

    setSchema() {
        this.Schema = new mongoose.Schema(
            {
                writer_id: { type: String, required: true },// unique: true, lowercase: true },
                project_id: { type: String, required: true },
                subject_id: { type: String, required: true },
                number: { type: Number, required: true },
                title: { type: String },
                tags: { type: [String] },
                text: { type: String },
                deleted: { type: Boolean, required: true }
            }
        );

        // Item들을 찾아다 줘요.
        // 서브젝트의 id들이 필요해요.
        this.Schema.statics['getItemList'] = function(ids: any[]) {
            const conditions = {$or:[]};
            for(let i = 0; i < ids.length; i++) {
                conditions['$or'].push({ subject_id: ids[i], deleted: false });
            }
            return this['find'](conditions);
        }
        
        // 단일 항목을 가져와요.
        this.Schema.statics['getItem'] = function (item_id: string) {
            return this['findOne']({ _id: item_id });
        }

        // Item 단일 항목을 수정합니다.
        // _id는 필수이며, 나머지 항목에 대해서는 수정하고자 하는 항목만 
        // 넣어주면 됩니다.
        // ex) {_id: '3434324234', title: '변경할 멘트'}
        this.Schema.statics['updateItem'] = function (json, callback) {
            const titleName = ['writer_id', 'project_id', 'subject_id', 'number', 'title', 'text', 'tags'];
            let conditions: any = {};
            for (let i = 0; i < titleName.length; i++) {
                if (json[titleName[i]] !== null && json[titleName[i]] !== undefined) {
                    conditions[titleName[i]] = json[titleName[i]];
                }
            }
            conditions = { $set: conditions };
            console.log(conditions);
            return this['update']({_id: json['_id']}, conditions, callback);
        }

        // 새로운 Item을 DB에 입력해요. 이때는 필수로 필요한 요소만 입력받아요.
        this.Schema.statics['insertItem'] = function (item: IItem): Promise<mongoose.Document> {
            console.log(`Into the inserItem function.`);
            let doc: mongoose.Document = new this();
            doc['deleted'] = false;
            doc['number'] = 1;
            doc['subject_id'] = item.subject_id;
            doc['project_id'] = item.project_id;
            doc['writer_id'] = item.writer_id;
            doc['title'] = item.title;
            return doc.save();
        }

        // Item들을 지워줍니다. 한개를 지울 때 써도 되긴 하는데, 배열에 id를 넣어서 주세요.
        this.Schema.statics['deleteItemsWithSubjectId'] = function (subjectIds: string[]): Promise<mongoose.Document> {
            let conditions: any;
            // console.log(`items.ts: deleteItemsWithSubjectId(): ${ subjectIds.length }`);
            if (subjectIds.length > 0) {
                conditions = [];
                for (let i = 0; i < subjectIds.length; i++) {
                    conditions.push({ subject_id: subjectIds[i] });
                }
                conditions = { $or: conditions };
                // console.log(`deleteItems()의 조건식은 : ${ JSON.stringify(conditions) }`);
                return this['update'](conditions, { $set: { deleted: true } }, { multi: true });
            } else {
                return new Promise<any>((resolve, reject) => { resolve({ msg: 'nothing' }) });
            }
        }

        // Item을 하나 지워줘요. Item의 id가 하나 필요해요.
        // 차후 필요하다면 배열로 Item의 id를 받아오는 것도 고려하고 있어요.
        this.Schema.statics['deleteItem'] = function (ItemId: string): Promise<mongoose.Document> {
            return this['update']({ _id: ItemId }, { $set: { deleted: true } });
        }
    }
}