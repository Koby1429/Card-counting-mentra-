const PORT = process.env.PORT || 3000;

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    let filePath = `./dist${url.pathname === "/" ? "/index.html" : url.pathname}`;

    return Bun.file(filePath).exists().then((exists) => {
      if (exists) {
        return new Response(Bun.file(filePath));
      }
      // SPA fallback - serve index.html for unknown routes
      return new Response(Bun.file("./dist/index.html"), {
        headers: { "Content-Type": "text/html" },
      });
    });
  },
});

console.log(`Server running on port ${PORT}`);
