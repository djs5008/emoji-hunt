# 🎯 Emoji Hunt

A real-time multiplayer game where players race to find hidden emojis! Built with Next.js, Redis, and Server-Sent Events.

## 🎮 Game Features

- **Multiplayer lobbies** - Create or join game rooms with unique 4-letter codes
- **Real-time gameplay** - Find the target emoji faster than your friends
- **5 rounds** of increasing difficulty
- **Live scoring** - See scores update in real-time
- **Mobile optimized** - Swipe to explore the emoji canvas on mobile devices
- **No sign-up required** - Jump right into the fun!

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (Edge Runtime)
- **Database**: Redis (Upstash Redis for production)
- **Real-time**: Server-Sent Events (SSE)
- **Deployment**: Vercel

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Redis instance (local or Upstash Redis)
- Vercel account (for deployment)

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/djs5008/emoji-hunt.git
cd emoji-hunt
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory:

```env
# For local development with Redis
REDIS_URL=redis://localhost:6379

# For production with Upstash Redis
UPSTASH_REDIS_REST_KV_REST_API_URL=your_upstash_url
UPSTASH_REDIS_REST_KV_REST_API_TOKEN=your_upstash_token
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start playing!

## 🌐 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project to [Vercel](https://vercel.com)
3. Configure environment variables in Vercel:
   - `UPSTASH_REDIS_REST_KV_REST_API_URL`
   - `UPSTASH_REDIS_REST_KV_REST_API_TOKEN`

### Setting up Upstash Redis

1. Create a free account at [Upstash](https://upstash.com)
2. Create a new Redis database
3. Copy the REST API credentials from the Upstash console
4. Add them to your Vercel environment variables

### Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

## 🏗️ Project Structure

```
emoji-hunt/
├── app/                    # Next.js app directory
│   ├── api/               # API routes (Edge functions)
│   ├── components/        # React components
│   ├── lib/              # Utility functions and game logic
│   ├── lobby/[id]/       # Dynamic lobby pages
│   └── page.tsx          # Home page
├── public/               # Static assets
└── package.json         # Dependencies and scripts
```

## 🎯 How to Play

1. **Create a lobby** or **join** with a 4-letter code
2. Wait for other players (or play solo!)
3. When the round starts, find the target emoji as fast as possible
4. Click/tap the correct emoji to score points
5. The faster you find it, the more points you get!
6. After 5 rounds, see who's the emoji hunt champion! 🏆

## 🔧 Development

### Key Technologies

- **Edge Runtime**: All API routes use Edge Runtime for better performance and no cold starts
- **SSE (Server-Sent Events)**: Real-time updates without WebSocket complexity
- **Redis Pub/Sub**: Handles real-time event broadcasting between players
- **Optimistic UI**: Immediate feedback for better user experience

### Running Tests

```bash
npm run test        # Run tests (if configured)
npm run lint        # Run ESLint
npm run type-check  # Run TypeScript checks
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🐛 Bug Reports

Found a bug? Please [open an issue](https://github.com/djs5008/emoji-hunt/issues) with:
- A clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with ❤️ using [Next.js](https://nextjs.org/)
- Deployed on [Vercel](https://vercel.com)
- Real-time data with [Upstash Redis](https://upstash.com)

---

🎮 **[Play Now!](https://emojihunt.fun)** | 🐛 **[Report Bug](https://github.com/djs5008/emoji-hunt/issues)** | ☕ **[Buy Me a Coffee](https://coff.ee/ttimhcsnad)**