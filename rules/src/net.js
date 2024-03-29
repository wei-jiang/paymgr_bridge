import io from 'socket.io-client';
const uuidv1 = require('uuid/v1');
import _ from 'lodash';
import util from './common/util';

window.cli_id = localStorage.getItem("uuid")
if( !window.cli_id ){
    window.cli_id = uuidv1()
    localStorage.setItem('uuid', cli_id);
} 

class Net {
    constructor() {
        this.sock = io();
        this.sock.on('connect', this.on_connect.bind(this));
        this.sock.on('mch_changed', this.on_mch_changed.bind(this));
        this.sock.on('usr_changed', this.on_usr_changed.bind(this));
        this.sock.on('pay_result', this.on_pay_result.bind(this));
        this.sock.on('need_login_first', this.on_need_login_first.bind(this));
    }
    register_ui_evt() {
        vm.$on("notify_seller_status", data => {
            this.emit('notify_seller_status', data)
        });
    }
    on_need_login_first(){
        util.show_noty('需登录后操作')
    }
    on_connect() {
        this.register_ui_evt()
        console.log('on_connect to socket.io server');
        this.emit('client_uuid', cli_id )
    }
    get_orders(openid, cb) {
        this.emit('get_orders', openid, orders => {
            cb(orders)
        });
    }
    
    emit(name, data, cb) {
        if (this.sock) {
            this.sock.emit(name, data, cb)
        }
    }
    emit_with_usr_token(name, data, cb) {
        if (this.sock) {
            data = data || {}
            data.token = sessionStorage.getItem("usr_token")
            this.sock.emit(name, data, cb)
        }
    }
    on_mch_changed(data) {
        window.vm.$emit('mch_changed', data);
    }
    on_usr_changed(data) {
        window.vm.$emit('usr_changed', data);
    }
    on_pay_result(res) {
        console.log( '支付通知：'+JSON.stringify(res) )
        window.vm.$emit('pay_result', res);
    }
    
}
export default new Net;