// Scratch-only: this environment has no compiled asset database, so these subclasses of the real test games
// compile the effects from the engine shader sources instead. Everything else is the unmodified test code.
using System.Threading.Tasks;
using Stride.Core.IO;
using Stride.Shaders.Compiler;

namespace Stride.Engine.Tests
{
    internal static class LinuxShaderSources
    {
        public static readonly string Root = System.Environment.GetEnvironmentVariable("DECAL_SHADER_ROOT");
    }

    public class LinuxDecalRenderingTests : DecalRenderingTests
    {
        protected override Task LoadContent()
        {
            EffectSystem.Compiler = new EffectCompiler(new FileSystemProvider(null, LinuxShaderSources.Root)) { SourceDirectories = { "shaders" } };
            return base.LoadContent();
        }
    }

    public class LinuxDecalRenderingWithoutDecalStageTests : DecalRenderingWithoutDecalStageTests
    {
        protected override Task LoadContent()
        {
            EffectSystem.Compiler = new EffectCompiler(new FileSystemProvider(null, LinuxShaderSources.Root)) { SourceDirectories = { "shaders" } };
            return base.LoadContent();
        }
    }
}

namespace Stride.Engine.Tests
{
    public class LinuxDecalLightingTests : DecalLightingTests
    {
        protected override System.Threading.Tasks.Task LoadContent()
        {
            EffectSystem.Compiler = new Stride.Shaders.Compiler.EffectCompiler(new Stride.Core.IO.FileSystemProvider(null, LinuxShaderSources.Root)) { SourceDirectories = { "shaders" } };
            return base.LoadContent();
        }
    }
}
