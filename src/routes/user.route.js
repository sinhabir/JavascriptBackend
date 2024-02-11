import { Router } from "express";
import { getCurrentUser, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { jwtverify } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount: 1
        },
        {
            name:"coverImage",
            maxCount: 1
        }
    ]),
    registerUser)

//login router
router.route("/login").post(loginUser)

//logout router
router.route("/logout").post(jwtverify,logoutUser)

//Refresh Token refresh
router.route("/refresh-token").post(refreshAccessToken)
router.route("/current-user").post(jwtverify, getCurrentUser)
router.route("/update-account").post(jwtverify, updateAccountDetails)

export default router