const { response } = require("express");
const ImageKit = require("imagekit");
require('dotenv').config();

// initialize ImageKit with environment variables
const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

// function for upload file to ImageKit
const uploadFile = async (file, fileName, folder = 'profile-image') => {
    try {
        const uploadParams = {
            file: file.buffer,
            fileName: fileName,
            folder: folder,
            useUniqueFileName: true,
            responseFields: ['url', 'thumbnailUrl' , 'fileId', 'name'],
        };

        const result = await imagekit.upload(uploadParams);

        return{
            success: true,
            data: {
                url: result.url,
                thumbnailUrl: result.thumbnailUrl,
                fileId: result.fileId,
                name: result.name
            }
        };
    } catch (error) {
        console.error('ImageKit upload error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

// function for delete file from ImageKit
const deleteFile = async (fileId) => {
    try{
        await imagekit.deleteFile(fileId);

        return {
            success: true,
            message: 'File deleted successfully'
        };
    }
    catch (error) {
        console.error('ImageKit delete error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

// function for generate signed URL for upload from frontend
const getUploadSigneture = () => {
    try{
        const authParams = imagekit.getAuthenticationParameters();

        return {
            success: true,
            data: authParams
        };
    } catch (error) {
        console.error('ImageKit get authentication parameters error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

// function for resize image with transformation
const getOptimizedImageUrl = (originUrl, transformations = {}) => {
    try{
        const{
            width = 400,
            height = 400,
            quality = 80,
            format= 'auto',
        } = transformations;

        // make url with transformation
        const transformedUrl = imagekit.url({
            src: originUrl,
            transformation: [{
                width: width,
                height: height,
                quality: quality,
                format: format,
                cropMode: 'maintain_ratio',
            }]
        });

        return {
            success: true,
            data: transformedUrl
        };
    } catch (error) {
        console.error('ImageKit get optimized image URL error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

// function for validate image file type
const validateImageFile = (file) => {
    const allowedTypes = ['image/jpeg', 'image/jpg' ,'image/png', 'image/webp'];

    // validate file type
    if(!allowedTypes.includes(file.mimetype)) {
        return {
            success: false,
            message: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.'
        };
    }

    // validate file size
    if(file.size > maxSize) {
        return {
            success: false,
            message: 'File size to large. Maximum size is 5MB.'
        };
    }

    return {
        success: true,
        message: 'File is valid.'
    };
};

// Export the functions
module.exports = {
    imagekit,
    uploadFile,
    deleteFile,
    getUploadSigneture,
    getOptimizedImageUrl,
    validateImageFile
};