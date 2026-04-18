import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

const str = "hello";
const u8 = decodeUTF8(str);
console.log("decodeUTF8 results in Uint8Array:", u8 instanceof Uint8Array, u8.length);

const back = encodeUTF8(u8);
console.log("encodeUTF8 results in string:", typeof back === 'string', back);
