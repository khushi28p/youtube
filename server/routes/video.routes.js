import express from 'express'
import mongoose from 'mongoose'

import User from "../models/user.model.js"
import Video from "../models/video.model.js"
import cloudinary from "../config/cloudinary.js"
import { checkAuth } from '../middlewares/auth.middleware.js'

const router = express.Router();

// Upload video
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

// Update video (not changing the video, just updating the metadata)
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

// Deleting a videoe
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

// Get all videos
router.get("/all", async(req, res) => {
    try{
        const videos = await Video.find().sort({createdAt: -1});
        res.status(200).json(videos);
    } catch(error){
        console.log(error);
        res.status(500).json({error: "something went wrong", message: error.message});
    }
})

// Get own videos
router.get("/my-videos", checkAuth, async(req, res) => {
    try{
        const videos = await Video.find({user_id: req.user._id}).sort({createdAt: -1});
        res.status(200).json(videos);
    } catch(error){
        console.error("Fetch errror:", error);
        res.status(500).json({message: "Something went wrong"});
    }
})

// Get video by ID
router.get("/:id", checkAuth, async(req, res) => {
    try{
        const videoId = req.params.id;
        const userId = req.user._id;

        const video = await Video.findByIdAndUpdate(
            videoId,
            {
                $addToSet: {viewedBy: userId}
            },
            {
                new: true
            }
        );

        if(!video) return res.status(404).json({error: "Video not found"});

        res.status(200).json(video);
    } catch(error){
        console.error("Fetch error:", error);
        res.status(500).json({message:"Something went wrong"});
    }
});

// Get video by category
router.get("/category/:category", async(req, res) => {
    try{
        const videos = await Video.find({category: req.params.category}).sort({createdAt: -1});

        res.status(200).json(videos);
    } catch(error){
        console.error("Fetch error:", error);
        res.status(500).json({message: "Something went wrong"})
    }
})

// Get video by tags
router.get("/tags/:tag", async(req, res) => {
    try{
        const tag = req.params.tag;
        const videos = await Video.find({tags: tag}).sort({createdAt: -1});
        res.status(200).json(videos);
    } catch(error){
        console.error("Fetch error", error);
        res.status(500).json({message: "Somethimg went wrog"})
    }
})

// Like video
router.post('/like', checkAuth, async(req, res) => {
    try{
        const { videoId } = req.body;
        await Video.findByIdAndUpdate(
            videoId,
            {
                $addToSet: {likes: req.user._id},
                $pull: {dislikes: req.user._id},
            }
        );

        res.status(200).json({message: "Liked the video"})
    } catch(error){
        console.error("Like error", error);
        res.status(500).json({error: "Something went wrong"})
    }
})

// Unlike video

router.post('/dislike', checkAuth, async(req, res) => {
    try{
        const { videoId } = req.body;

        await Video.findByIdAndUpdate(
            videoId,
            {
                $addToSet: {dislikes: req.user._id},
                $pull: {likes: res.user._id},
            }
        );

        res.status(200).json({message: "Dislikes the video"});
    } catch(error){
        console.log('Dislike error:', error);
        res.status(500).json({error: "something went wrong"})
    }
})

export default router;