import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class GoogleLoginDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    username: string;

    @IsString()
    @IsNotEmpty()
    profilePicture: string;
}
