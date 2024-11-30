import { createClient } from './supabase/client';

export async function uploadTokenMetadata(file: File, tokenSymbol: string, description: string = ""): Promise<string> {
    try {
        const supabase = createClient();

        // Create unique file path using token symbol and timestamp
        const timestamp = Date.now();
        const imageFilePath = `token-images/${tokenSymbol.toLowerCase()}-${timestamp}`;
        const metadataFilePath = `token-metadata/${tokenSymbol.toLowerCase()}-metadata.json`;

        // Upload the image file to Supabase storage
        const { error: imageError } = await supabase.storage
            .from('token')
            .upload(imageFilePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (imageError) {
            throw imageError;
        }

        // Get public URL for the uploaded image
        const { data: { publicUrl } } = supabase.storage
            .from('token')
            .getPublicUrl(imageFilePath);

        // Create metadata JSON
        const metadata = {
            name: tokenSymbol.toUpperCase(),
            description: description,
            image: publicUrl,
            xlink: "",
            homepage: "",
            telegram: "",
            discord: ""
        };

        // Upload metadata JSON file
        const { error: metadataError } = await supabase.storage
            .from('token')
            .upload(metadataFilePath, JSON.stringify(metadata, null, 2), {
                contentType: 'application/json',
                cacheControl: '3600',
                upsert: true
            });

        if (metadataError) {
            throw metadataError;
        }

        return `https://ooogjkasqhpnsberinyu.supabase.co/storage/v1/object/public/token/${metadataFilePath}`;

    } catch (error) {
        console.error('Error uploading token files:', error);
        throw new Error('Failed to upload token files');
    }
}
