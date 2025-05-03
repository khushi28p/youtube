import mongoose from 'mongoose'

export const ConnectDB = async() => {
    try{
        await mongoose.connect (process.env.MONGO_URI);
        console.log('Database connected successfully'); 
    } catch(error){
        console.log(error.message);
        throw new Error('Database connection failed');
    }
}