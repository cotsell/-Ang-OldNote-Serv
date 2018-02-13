import * as mongoose from 'mongoose';
import { Mongo } from './mongo';
import { IProject } from '../Interface';

export class project {
  Schema: mongoose.Schema;

  constructor() {
    this.setSchema();
  }

  getModel(): mongoose.Model<mongoose.Document> {
    return mongoose.model('project', this.Schema);
  }

  setSchema() {
    this.Schema = new mongoose.Schema({
        //id: { type: String, required: true, unique: true, lowercase: true },
        writer_id: { type: String, required: true },
        number: { type: Number, required: true },
        title: { type: String, required: true },
        deleted: { type: Boolean, required: true }
    });

    this.Schema.statics['getProjectList'] = function (id: string): Promise<mongoose.Document> {
      return this['find']({ $and: [{ writer_id: id }, { deleted: false }] });
    }

    this.Schema.statics['getProjectOne'] = function (project_id: string): Promise<mongoose.Document> {
      return this['findOne']({ $and: [{ _id: project_id }, { deleted: false }] });
    }

    // Project 단일 항목을 수정합니다.
    // _id는 필수이며, 나머지 항목에 대해서는 수정하고자 하는 항목만
    // 넣어주면 됩니다.
    // ex) {_id: '3434324234', title: '변경할 멘트'}
    this.Schema.statics['updateProject'] = function(json) {
      const titleName = ['writer_id', 'number', 'title'];
      let conditions: any = {};
      for (let i = 0; i < titleName.length; i++) {
        if (json[titleName[i]] !== null && json[titleName[i]] !== undefined) {
            conditions[titleName[i]] = json[titleName[i]];
        }
      }
      conditions = { $set: conditions };
      return this['update']({_id: json['_id']}, conditions);
    }

    // 새로운 프로젝트를 만들어요.
    // TODO :: 아직 number를 제대로 작동하게 할 수 없어서, 임시로 1로 대체했어요.
    this.Schema.statics['insertProject'] = function(json: IProject) {
      let doc: mongoose.Document = new this();
      doc['deleted'] = false;
      doc['number'] = 1;
      doc['writer_id'] = json.writer_id;
      doc['title'] = json.title;
      return doc.save();
    }

    // findByIdAndUpdate()처리 변경. 주석으로만 남겨둘께요.
    // this.Schema.statics['deleteProject'] = function(_id: string): Promise<mongoose.Document> {
    //     return this['update']({ _id: _id }, { $set: { deleted: true } });
    // }

    // Project의 id로 하나의 프로젝트를 삭제합니다.
    // 삭제된 문서를 결과로 돌려줍니다.
    this.Schema.statics['deleteProject'] = function(_id: string): Promise<mongoose.Document> {
      return this['findByIdAndUpdate']({ _id: _id },
                                        { $set: { deleted: true } },
                                        { new: true });
    }
  }
}