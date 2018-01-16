const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const _ = require('lodash');
const moment = require('moment');
const credential = require('../secret')

function get_ip_by_sock(sock) {
    let rip = sock.handshake.headers['x-forwarded-for'];
    //console.log(rip);
    return rip;
}
function get_ip_by_req(req) {
    let cli_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    cli_ip = Array.isArray(cli_ip) ? cli_ip[0] : cli_ip;
    if (cli_ip.indexOf(',') > 0) {
        cli_ip = cli_ip.substring(0, cli_ip.indexOf(','));
    }
    return cli_ip;
}
let get_myurl_by_req = (req) => {
    //depend on nginx config
    let host = req.headers['host'];
    let proto = req.headers['x-forwarded-proto'] || 'http';
    let port = req.headers['x-forwarded-port'];
    let url = `${proto}://${host}`
    if(port) url = url + `:${port}`
    // console.log(req.headers);
    // console.log(url);
    return url;
}
let get_myurl_by_sock = (sock) => {
    //depend on nginx config
    let host = sock.handshake.headers['host'];
    let proto = sock.handshake.headers['x-forwarded-proto'] || 'http';
    let port = sock.handshake.headers['x-forwarded-port'];
    let url = `${proto}://${host}`
    if(port) url = url + `:${port}`
    // console.log(sock.handshake.headers);
    // console.log(url);
    return url;
}


function sign_token_1h(data) {
    return jwt.sign(data, credential.token_key, { expiresIn: '1h' });
}
function sign_token(data) {
    return jwt.sign(data, credential.token_key);
}
function verify_token(token, cb) {
    jwt.verify(token, credential.token_key, cb);
}
function verify_req(data, judge) {
    return new Promise((resolve, reject) => {
        if (!data.token || !data.body || !data.total_fee) {
            reject('wrong parameters')
        } else {
            if(judge && !judge(data) ){
                reject('wrong parameters')
            } else {
                verify_token(data.token, (err, decoded) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(decoded);
                    }
                })
            }            
        }
    })
}
//two type of token: mch_token, usr_token
function verify_usr(data) {
    return new Promise((resolve, reject) => {
        if(data.token){
            verify_token(data.token, (err, decoded) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(decoded);
                }
            })
        } else {
            reject('no login info presents')
        }        
    })
}
function notify_or_save_pay_result(order_id, resp, io, res) {
    function find_and_delete(data) {
        m_db.collection('pending_order').findOneAndDelete({
            "sock_status": "valid",
            out_trade_no: order_id
        })
            .then(r => {
                let o = r.value
                // console.log('find pending order', o);
                if (o) {
                    let order = {
                        body: o.body,
                        sub_mch_id: o.sub_mch_id,
                        out_trade_no: o.out_trade_no,
                        total_fee: o.total_fee,
                        spbill_create_ip: o.spbill_create_ip,
                        trade_type: o.trade_type,
                        time_begin: moment(o.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                        time_end: moment().format("YYYY-MM-DD HH:mm:ss")
                    }
                    io.to(o.sock_id).emit('pay_result', order);
                    m_db.collection('orders').insert(order)
                    res.end('success');
                } else {
                    // console.log('can not find pending order');
                    setTimeout(_.partial(find_and_update, data), 0)
                }
            })
            .catch(err => {
                // console.log('find pending order failed, err=', err);
            })
    }
    function find_and_update(data) {
        m_db.collection('pending_order').findOneAndUpdate(
            {
                "sock_status": "invalid",
                out_trade_no: order_id
            },
            {
                $set: { "pay_status": "valid", noty_data: data }
            }
        )
            .then(r => {
                // console.log('find_and_update', r)
                if (r.ok == 1) {
                    res.end('success');
                } else {
                    setImmediate(_.partial(find_and_delete, data))
                }
            })
            .catch(err => {
                setImmediate(_.partial(find_and_delete, data))
            })
    }
    find_and_delete(resp)
}
function hash_str(str){
    return crypto.createHash('md5').update(str).digest("hex");
}

module.exports = {
    hash_str,
    get_ip_by_sock,
    get_ip_by_req,
    get_myurl_by_req,
    get_myurl_by_sock,
    sign_token,
    sign_token_1h,
    verify_token,
    verify_req,
    verify_usr,
    notify_or_save_pay_result
}