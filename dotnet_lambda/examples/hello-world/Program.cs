using System;

namespace ConsoleApplication
{
    public class Program
    {
        public static void Main(string[] args)
        {
            Console.WriteLine("Hello World!");
            var eventString = args[0];
            Console.WriteLine("Event : " + eventString );
        }
    }
}
