import mongoose, {Mongoose, isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

//******************************************/
// toggle subscription
const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params

    if(!isValidObjectId(channelId)){
        throw new ApiError(400, "Invalid Channel Id")
    }

    const isSubscribed = await Subscription.findOne({
        channel: channelId,
        subscriber: req.user?._id
    })

    //if already subscribed , unsubscribe
    if(isSubscribed){
        const unsubsribe =  
            await Subscription.findByIdAndDelete(isSubscribed?._id)
            if(!unsubsribe){
                throw ApiError(500, "Unsubscribing unsuccessful!!")
            }
            return res.status(200)
            .json(new ApiResponse
                (200, {subscribed: false}, "Unsubscribed succesfully"))
    }

    //if not subscribed create a subscription
    const toSubscribe = await Subscription.create({
        subscriber: req.user?._id,
        channel: channelId
    })

    if(!toSubscribe){
        throw ApiError(500, "Error while subscribing")
    }

    return res.status(200)
    .json(new ApiResponse
        (200, {subscribed: true}, "Subscribed succesfully"))
    
})

//******************************************/
// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params

    if(!isValidObjectId(channelId)){
        throw ApiError(400, "Invalid Channel Id")
    }

    if(req.user?._id.toString() !== channelId.toString()){
        throw ApiError(400, "Not Authorised to get subscribers list")
    }

    const getSubscribersList = await Subscription.aggregate([
        {
            $match:{
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $facet:{
                subscribers:[
                    {
                        $lookup:{
                            from: "users",
                            localField: "subscriber",
                            foreignField: "_id",
                            as: "subscriber",
                            pipeline:[
                                {
                                    $project:{
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1,
                                        createdBy: 1,
                                        updatedAt: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                      $addFields:{
                        subscriber: {
                            $first: "$subscriber"
                        }
                      }  
                    }
                ],
                subscribersCount:[
                    {$count: "subscribers"}
                ]
            }
        }
    ])

    return res.status(200)
    .json(new ApiResponse
        (200, getSubscribersList[0], "All subscribers fetched successfully"))
})

//******************************************/
// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    if(!isValidObjectId(subscriberId)){
        throw ApiError(400, "Invalid Subscriber Id")
    }

    if(req.user?._id.toString() !== subscriberId.toString()){
        throw ApiError(400, "Not Authorised to get subscribers list")
    }

    const getChannelList = await Subscription.aggregate([
        {
            $match:{
                subscriber: new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $facet:{
                channelSubscribedTo:[
                    {
                        $lookup:{
                            from: "users",
                            localField: "channel",
                            foreignField: "_id",
                            as: "channel",
                            pipeline:[
                                {
                                    $project:{
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1,
                                        createdBy: 1,
                                        updatedAt: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                      $addFields:{
                        channel: {
                            $first: "$channel"
                        }
                      }  
                    }
                ],
                channelsCount:[
                    {$count: "channelSubscribedTo"}
                ]
            }
        }
    ])

    return res.status(200)
    .json(new ApiResponse
        (200, getChannelList[0], "All Channels fetched successfully"))
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}