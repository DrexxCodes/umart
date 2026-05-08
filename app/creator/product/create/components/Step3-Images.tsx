'use client'

import React from "react"
import { useState, useRef, useEffect } from 'react'
import { Upload, X, Loader2, ImageIcon, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { uploadImageToCloudinary, UploadProgress } from '@/lib/cloudinary'

interface Step3Props {
  data: {
    images: string[]
  }
  onChange: (data: any) => void
  onNext: () => void
  onPrevious: () => void
}

interface ImageUpload {
  id: string
  file: File
  preview: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  url?: string
  error?: string
}

export function Step3Images({
  data,
  onChange,
  onNext,
  onPrevious,
}: Step3Props) {
  const [imageUploads, setImageUploads] = useState<ImageUpload[]>([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadingRef = useRef<Set<string>>(new Set())

  // Auto-upload pending images
  useEffect(() => {
    const pendingImages = imageUploads.filter(
      (img) => img.status === 'pending' && !uploadingRef.current.has(img.id)
    )

    pendingImages.forEach((image) => {
      uploadingRef.current.add(image.id)
      uploadImage(image.id)
    })
  }, [imageUploads])

  // Sync uploaded images to parent component
  useEffect(() => {
    const uploadedImages = imageUploads
      .filter((img) => img.status === 'success')
      .map((img) => img.url)
      .filter((url): url is string => !!url)

    onChange({
      ...data,
      images: uploadedImages,
    })
  }, [imageUploads])

  const handleFileSelect = (files: FileList) => {
    const maxImages = 15
    const currentCount = imageUploads.filter(
      (img) => img.status === 'success'
    ).length
    const remainingSlots = maxImages - currentCount

    if (remainingSlots <= 0) {
      alert(`Maximum ${maxImages} images allowed`)
      return
    }

    Array.from(files).slice(0, remainingSlots).forEach((file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        console.warn(`Skipping non-image file: ${file.name}`)
        return
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        console.warn(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB): ${file.name}`)
        alert(`${file.name} is too large. Maximum file size is 10MB.`)
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        const newUpload: ImageUpload = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview: reader.result as string,
          progress: 0,
          status: 'pending',
        }
        setImageUploads((prev) => [...prev, newUpload])
      }
      reader.onerror = () => {
        console.error(`Failed to read file: ${file.name}`)
      }
      reader.readAsDataURL(file)
    })
  }

  const uploadImage = async (imageId: string) => {
    setImageUploads((prev) =>
      prev.map((img) =>
        img.id === imageId ? { ...img, status: 'uploading' as const, progress: 0 } : img
      )
    )

    try {
      const upload = imageUploads.find((img) => img.id === imageId)
      if (!upload) {
        throw new Error('Upload not found')
      }

      console.log(`Starting upload for image: ${upload.file.name}`)

      const response = await uploadImageToCloudinary(
        upload.file,
        (progress: UploadProgress) => {
          setImageUploads((prev) =>
            prev.map((img) =>
              img.id === imageId ? { ...img, progress: progress.percentage } : img
            )
          )
        }
      )

      console.log(`Upload successful for: ${upload.file.name}`, response)

      setImageUploads((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? {
                ...img,
                status: 'success' as const,
                url: response.secure_url,
                progress: 100,
              }
            : img
        )
      )

      uploadingRef.current.delete(imageId)
    } catch (error: any) {
      console.error(`Upload failed for image ${imageId}:`, error)
      
      uploadingRef.current.delete(imageId)
      setImageUploads((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? {
                ...img,
                status: 'error' as const,
                error: error.message || 'Upload failed',
                progress: 0,
              }
            : img
        )
      )
    }
  }

  const handleRemove = (imageId: string) => {
    uploadingRef.current.delete(imageId)
    setImageUploads((prev) => prev.filter((img) => img.id !== imageId))
  }

  const handleRetry = (imageId: string) => {
    uploadingRef.current.delete(imageId)
    setImageUploads((prev) =>
      prev.map((img) =>
        img.id === imageId ? { ...img, status: 'pending' as const, error: undefined } : img
      )
    )
  }

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files)
    }
  }

  const successCount = imageUploads.filter((img) => img.status === 'success').length
  const uploadingCount = imageUploads.filter((img) => img.status === 'uploading').length
  const errorCount = imageUploads.filter((img) => img.status === 'error').length
  const maxImages = 15

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Step 3: Product Images</CardTitle>
        <CardDescription>
          Upload up to {maxImages} images. Drag and drop or click to select. Maximum 10MB per image.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          } ${successCount >= maxImages ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => successCount < maxImages && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
            className="hidden"
            disabled={successCount >= maxImages}
          />

          <div className="space-y-2">
            <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">
                {successCount >= maxImages
                  ? 'Maximum images reached'
                  : 'Drop images here or click to browse'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {successCount}/{maxImages} images uploaded
                {uploadingCount > 0 && ` · ${uploadingCount} uploading`}
                {errorCount > 0 && ` · ${errorCount} failed`}
              </p>
            </div>
          </div>
        </div>

        {/* Image Grid */}
        {imageUploads.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {imageUploads.map((upload) => (
              <div key={upload.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-border">
                  <img
                    src={upload.preview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />

                  {/* Upload Progress Overlay */}
                  {upload.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-white mx-auto mb-2" />
                        <p className="text-xs text-white font-medium">
                          {upload.progress}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Success Overlay */}
                  {upload.status === 'success' && (
                    <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-green-500 text-white text-xs px-2 py-1 rounded">
                        ✓ Uploaded
                      </div>
                    </div>
                  )}

                  {/* Error State */}
                  {upload.status === 'error' && (
                    <div className="absolute inset-0 bg-destructive/90 flex flex-col items-center justify-center p-2">
                      <AlertCircle className="w-6 h-6 text-white mb-1" />
                      <p className="text-xs text-white text-center line-clamp-2">
                        {upload.error}
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRetry(upload.id)
                        }}
                        className="mt-2 h-6 text-xs"
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(upload.id)
                  }}
                  className="absolute -top-2 -right-2 bg-destructive hover:bg-destructive/90 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>

                {/* Status Badge */}
                {upload.status === 'success' && (
                  <div className="absolute bottom-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow">
                    ✓
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* No Images Message */}
        {imageUploads.length === 0 && (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              No images uploaded yet. Start by selecting or dragging images.
            </p>
          </div>
        )}
      </CardContent>

      <div className="flex gap-3 justify-between p-6 border-t border-border">
        <Button 
          variant="outline" 
          onClick={onPrevious} 
          className="w-full sm:w-auto"
        >
          Previous
        </Button>
        <Button
          onClick={onNext}
          disabled={successCount === 0 || uploadingCount > 0}
          className="w-full sm:w-auto"
        >
          {uploadingCount > 0 ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading {uploadingCount}...
            </>
          ) : (
            'Next Step'
          )}
        </Button>
      </div>
    </Card>
  )
}