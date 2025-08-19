import * as argon from 'argon2'
export class Util {
    public static hash (token: string | Buffer) {
        return argon.hash(token)
    }

    public static match(token: string, text: string | Buffer){
        return argon.verify(token,text)
    }
}