FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy the entire project
COPY . .

# Build the client
RUN npm run build

# Install server dependencies
WORKDIR /app/server
RUN npm install

# Go back to the root directory
WORKDIR /app

# Expose the port the app runs on
EXPOSE 5000

# Define environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Start the application
CMD ["npm", "start"]
