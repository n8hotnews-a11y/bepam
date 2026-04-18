import React, { useState } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, FONTS, TYPOGRAPHY } from '../constants/theme';

const placeholderImage = require('../../assets/recipe-placeholder.png');

const RecipeImage = ({
    uri,
    style,
    resizeMode = 'cover',
    defaultIcon = 'restaurant-menu', // standard food icon
    iconSize = 24,
    showPlaceholderText = false,
    placeholderText = 'Món ngon'
}) => {
    const [error, setError] = useState(false);

    // If no URI or error loading, show placeholder image
    if (!uri || error) {
        return (
            <Image
                source={placeholderImage}
                style={style}
                resizeMode="cover"
            />
        );
    }

    return (
        <Image
            source={{ uri }}
            style={style}
            resizeMode={resizeMode}
            onError={() => setError(true)}
        />
    );
};

const styles = StyleSheet.create({
    placeholderContainer: {
        backgroundColor: COLORS.primaryMuted || '#FEF3C7', // Fallback color if primaryMuted undefined
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
    placeholderText: {
        ...TYPOGRAPHY?.caption, // Safe access
        fontFamily: FONTS?.bold,
        color: COLORS.primary,
        marginTop: 4,
        fontSize: 10,
        textAlign: 'center'
    }
});

export default RecipeImage;
