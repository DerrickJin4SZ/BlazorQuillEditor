using EditorTestProject.Components;
using Microsoft.AspNetCore.SignalR;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();
builder.Services.AddControllers(); // 添加 MVC 控制器支持
/*
 Blazor Server apps use a SignalR WebSocket to communicate between the client (browser) and server. 
The SignalR WebSocket has a default maximum message size of 32 KB.
A large Editor Value, FileSelect file size, or a PDFViewer Data can exceed the maximum SignalR message size, which will close the connection and abort the current application task.
 */
builder.Services.Configure<HubOptions>(option => option.MaximumReceiveMessageSize = null);
builder.Services.AddServerSideBlazor().AddHubOptions(options => {
    options.MaximumReceiveMessageSize = null; // no limit or use a number
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}



app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseRouting();
app.UseAntiforgery();
// 5. 映射中间件
app.MapControllers(); // 映射 MVC 控制器路由


app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
