import React from 'react';

/* 
  The user provided an "Image" component which seems to be the card container 
  (judging by dimensions 501x729 and opacity). 
  I will adapt this to be the Card wrapper.
*/

const styles = {
    ImageContainer: {
        /* Dimensions from design, but adapted for responsiveness */
        width: '100%',
        maxWidth: '456px',
        // height: '729px', /* Allow height to fit content */
        minHeight: '600px',
        borderRadius: '18px',
        // opacity: 0.88, /* This opacity on a container makes content inside transparent too. Careful. */
        backgroundColor: 'rgba(255, 255, 255, 0.50)', /* Using rgba for bg opacity instead of element opacity */
        backdropFilter: 'blur(10px)',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    },
};

// background-image property was in the user snippet, but it pointed to ./image.png. 
// Use the glass card concept instead as it contains the form.

const CardContainer = ({ children }) => {
    return (
        <div style={styles.ImageContainer}>
            {children}
        </div>
    );
};

export default CardContainer;
