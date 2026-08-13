CineMatch

CineMatch is a movie discovery and recommendation web app powered by the TMDB API. It helps users discover movies based on their tastes, mood, and viewing history through a simple, responsive interface.

Features

- 🎬 Personalized movie recommendations
- ⭐ Select movies you already love to improve recommendations
- 🔎 Search for movies using TMDB
- 🎭 Browse recommendations by mood and genre
- 🎟️ Movie cards with posters, ratings, release years, and descriptions
- ✅ Mark movies as watched
- 📚 Keep track of your watched collection
- 🔀 Discover new movies with randomized recommendations
- 📱 Responsive interface for desktop and mobile

Tech Stack

- React
- Vite
- JavaScript
- Lucide React
- TMDB API

Getting Started

1. Clone the repository

git clone https://github.com/Ofcnitin/Movie-Matcher.git
cd Movie-Matcher

2. Install dependencies

npm install

3. Configure the TMDB API key

Create a ".env" file in the project root:

VITE_TMDB_API_KEY=your_tmdb_api_key_here

You can use ".env.example" as a template.

Never commit your ".env" file or your real API key to GitHub.

4. Start the development server

npm run dev

The application will be available at the local URL shown by Vite.

Environment Variables

The project uses:

VITE_TMDB_API_KEY=

The ".env" file is excluded from Git through ".gitignore". Only ".env.example", which contains a placeholder, should be included in the repository.

Important Security Note

The TMDB key is required by the frontend to make API requests. Keeping it in ".env" prevents the key from being committed to the GitHub repository, but it does not make the key completely secret once the frontend is running in a browser.

A production setup that requires the key to remain completely private would use a backend or API proxy instead of making TMDB requests directly from the browser.

Project Structure

Movie-Matcher/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── .gitignore
└── README.md

License

This project is intended for learning and personal development.