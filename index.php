<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>An Tigín Glengarriff - Your Idyllic Off-Grid Escape</title>
    <!-- Load Tailwind CSS from CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Google Font: Inter -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f8f8f8; /* Light background for the whole page */
        }
        .banner-background {
            /* Fallback background color if image fails to load */
            background-color: #475746; /* A soft green/gray */
            background-image: url('files/gallery/kayaking-2024d.jpg');
            background-size: cover;
            background-position: center;
            height: 50vh; /* Responsive height for the banner */
            min-height: 300px; /* Minimum height for smaller screens */
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden; /* Ensures content doesn't overflow if image is too large */
        }
        .banner-overlay {
            background-color: rgba(0, 0, 0, 0.3); /* Semi-transparent overlay for text readability */
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    </style>
</head>
<body class="text-gray-800">

    <!-- Navigation Bar -->
    <nav class="bg-gray-800 p-4 shadow-md">
        <div class="container mx-auto flex justify-between items-center">
            <a href="index.html" class="text-white text-2xl font-bold">An Tigín</a>
            <div>
                <a href="index.html" class="text-white px-4 py-2 rounded-md hover:bg-gray-700 transition duration-300">Home</a>
                <a href="gallery.html" class="text-white px-4 py-2 rounded-md hover:bg-gray-700 transition duration-300">Gallery</a>
                <a href="calendar.html" class="text-white px-4 py-2 rounded-md hover:bg-gray-700 transition duration-300">Calendar</a>
                <a href="contact.html" class="text-white px-4 py-2 rounded-md hover:bg-gray-700 transition duration-300">Contact Us</a>
            </div>
        </div>
    </nav>

    <!-- Banner Section -->
    <header class="banner-background shadow-md">
        <div class="banner-overlay">
            <div class="text-center p-4">
                <h1 class="text-5xl md:text-6xl font-bold text-white drop-shadow-lg mb-4 rounded-lg px-4 py-2">
                    An Tigín Glengarriff
                </h1>
                <p class="text-xl md:text-2xl text-white drop-shadow-md italic">
                    Your Idyllic Off-Grid Escape
                </p>
            </div>
        </div>
    </header>

    <!-- Main Content Section -->
    <main class="container mx-auto px-4 py-12 max-w-4xl">
        <section class="bg-white p-8 md:p-12 rounded-xl shadow-lg mb-12">
            <h2 class="text-4xl font-semibold text-center text-gray-800 mb-6">Welcome to An Tigín</h2>
            <p class="text-lg leading-relaxed text-gray-700 mb-4 text-justify">
                A warm and cosy off-grid cabin nestled between the mountains and the sea. Here, you can experience an idyllic escape from the hustle and bustle of everyday life. Located on the "Wild Atlantic Way" and just 3km from the picturesque village of Glengarriff, An Tigín offers a perfect blend of relaxation and nature.
            </p>
            <p class="text-lg leading-relaxed text-gray-700 text-justify">
                Whether you choose to swim in the calm waters, explore the stunning landscapes, or simply prefer to curl up with a good book by the fire, An Tigín provides the perfect setting to unplug and recharge your mind and body.
            </p>
        </section>

        <!-- Contact Section -->
        <section class="bg-gray-700 text-white p-8 md:p-10 rounded-xl shadow-lg text-center">
            <h2 class="text-3xl font-semibold mb-4">Ready to Unplug?</h2>
            <p class="text-xl mb-4">Contact us to book your serene escape:</p>
            <div class="flex flex-col md:flex-row justify-center items-center gap-4">
                <p class="text-2xl font-bold">Shane / Geri</p>
                <a href="tel:+353838128308" class="bg-white text-gray-700 font-bold py-3 px-6 rounded-full shadow-md hover:bg-gray-100 transition duration-300 ease-in-out">
                    Call: 0838128308
                </a>
            </div>
        </section>
    </main>

    <!-- Footer (Optional, but good practice) -->
    <footer class="bg-gray-800 text-white text-center py-6 mt-12">
        <p>&copy; 2025 An Tigín Glengarriff. All rights reserved.</p>
    </footer>

</body>
</html>

