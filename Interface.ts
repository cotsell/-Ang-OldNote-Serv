export interface IProject {
    _id?: string;
    title?: string;
    writer_id?: string;
    num?: number;
 }

export interface ISubject {
    _id?: string;
    writer_id?: string;
    project_id?: string;
    number?: number;
    title?: string;
}

export interface IItem {
    _id?: string;
    writer_id?: string;
    project_id?: string;
    subject_id?: string;
    number?: number;
    title?: string;
    text?: string;
    tags?: string[];
    checkbox_list?: ICheckboxList;
}

export interface ICheckboxList {
    id?: string;
    title: string;
    list: ICheckbox[];
}

export interface ICheckbox {
    id?: string;
    isChecked?: boolean;
    text?: string;
    sortNumber?: number;
}

export interface ITag {
    _id?: string;
    title?: string;
    writer_id?: string;
    number?: number;
}

export interface IUser {
    _id?: string;
    id?: string;
    display_name?: string;
    account_div?: number;
}

export class DumyClass {

}
