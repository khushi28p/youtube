import express from 'express'
import mongoose from 'mongoose'

import User from "../models/user.model.js"
import Video from "../models/video.model.js"
import cloudinary from "../config/cloudinary.js"
import { checkAuth } from '../middlewares/auth.middleware.js'

const router = express.Router();

router.post("/upload", checkAuth, async(req, res) => {
    try{
        const {title, description, category, tags} = req.body;

        if(!req.files || !req.files.video || !req.files.thumbnail){
            req.status(400).json({error: "Video and thumbnail are required"});
        }

        const videoUpload = await cloudinary.uploader.upload(req.files.video.tempFilePath,{
            resource_type: "video",
            folder: "videos"
        })

        const thumbnailUpload = await cloudinary.uploader.upload(req.files.thumbnail.tempFilePath,{
            folder: "thumbnails"
        })

        const newVideo = new Video({
            _id: new mongoose.Types.ObjectId(),
            title,
            description,
            user_id: req.user._id,
            videoUrl: videoUpload.secure_url,
            videoId: videoUpload.public_id,
            thumbnailUrl: thumbnailUpload.secure_url,
            thumbnailId: thumbnailUpload.public_id,
            category,
            tags: tags ? tags.split(",") : [],
        })

        await newVideo.save();

        res.status(201).json({message: "Video uploaded successfully", video: newVideo})

    }catch(error){
        console.log(error);
        res.status(500).json({error: "something went wrong", message: error.message});
    }
})

router.put("/update/:id", checkAuth, async(req, res)=> {
    try{
        const {title, description, category, tags} = req.body;
        const videoId = req.params.id

        let video = await Video.findById(videoId);
        if(!video){
            return res.status(404).json({error: "Video not found"})
        }

        if(video.user_id.toString() !== req.user._id.toString()){
            return res.status(403).json({error: "Unauthorized "})
        }

        if(req.files && req.files.thumbnail){
            await cloudinary.uploader.destroy(video.thumbnailId);

            const thumbnailUpload = await cloudinary.uploader.upload(req.files.thumbnail.tempFilePath, {
                folder: "thumbnail"
            })

            video.thumbnailUrl = thumbnailUpload.secure_url;
            video.thumbnailId = thumbnailUpload.public_id;
        }

        video.title = title || video.title;
        video.description = description || video.description;
        video.category = category || video.category;
        video.tags = tags ? tags.split(",") : video.tags;

        await video.save();
        res.status(200).json({message: "Video updated successfully", video})
    }catch(error){
        console.log(error);
        res.status(500).json({error: "something went wrong", message: error.message});
    }
})

router.delete("/delete/:id", checkAuth, async(req, res) => {
    try{
        const videoId = req.params.id;

        let video = await Video.findById(videoId);
        if(!video) return res.status(404).json({error: "Video not found"});

        if (video.user_id.toString() !== req.user._id.toString()){
            return res.status(403).json({error: "Unauthorized"})
        }

        await cloudinary.uploader.destroy(video.videoId, {resource_type: "video"});
        await cloudinary.uploader.destroy(video.thumbnailId);

        await Video.findByIdAndDelete(videoId);
        res.status(200).json({message: "Video deleted successfully"})
    }catch(error){
        console.log(error);
        res.status(500).json({error: "something went wrong", message: error.message});
    }
})

router.get("/all", async(req, res) => {
    try{
        const videos = await Video.find().sort({createdAt: -1});
        res.status(200).json(videos);
    } catch(error){
        console.log(error);
        res.status(500).json({error: "something went wrong", message: error.message});
    }
})

export default router;